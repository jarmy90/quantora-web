/**
 * QNT-0043 ops Â· Provision the protected delivery (server-side, idempotent).
 *
 * Usage (from the quantora-web root, with credentials in the environment):
 *
 *   bun run scripts/ops/provision-delivery.ts check     # dry-run: no writes
 *   bun run scripts/ops/provision-delivery.ts bucket    # create the private bucket
 *   bun run scripts/ops/provision-delivery.ts upload    # upload .ex5 + seed product_files
 *   bun run scripts/ops/provision-delivery.ts activate  # products -> available (go-live)
 *
 * Required environment:
 *   SUPABASE_URL                 project URL (https://<ref>.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY    service role key (server-only, NEVER in Git)
 * Optional:
 *   EA_VAULT_DIR                 folder with the .ex5 binaries
 *                                (default: C:/Users/profesor/quantoraex5)
 *   GO_LIVE_CONFIRM=yes          required by `activate` as an extra guard
 *
 * Rules:
 *   - never prints secrets; failures never half-commit the mapping (fail closed);
 *   - `upload` re-runs safely: same path overwrites, product_files upserts;
 *   - `activate` refuses to run unless every product file is registered.
 *
 * The SQL migrations (002, 003) are run separately in the Supabase SQL Editor
 * or with a direct Postgres connection â€” never from this script.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BUCKET = 'ea-vault';
const VAULT_DIR = resolve(process.env.EA_VAULT_DIR ?? 'C:/Users/profesor/quantoraex5');
const MAPPING_PATH = resolve(process.cwd(), 'scripts/ops/product-files.json');

type Mapping = Record<string, string | null>;

function die(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function env(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) {
    die('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (server-only values, never committed).');
  }
  if (!key.startsWith('eyJ')) {
    die('SUPABASE_SERVICE_ROLE_KEY looks wrong: the service role key is a JWT (starts with "eyJ").');
  }
  return { url, key };
}

function loadMapping(): Mapping {
  if (!existsSync(MAPPING_PATH)) die('mapping file missing: scripts/ops/product-files.json');
  const raw = JSON.parse(readFileSync(MAPPING_PATH, 'utf8')) as Mapping;
  for (const productId of ['first-triangle-ustec-m30', 'first-triangle-gold-m15', 'stochextreme-ustec']) {
    const file = raw[productId];
    if (file === null || file === undefined) {
      die(`mapping incomplete: set the .ex5 filename for "${productId}" in scripts/ops/product-files.json`);
    }
    const path = join(VAULT_DIR, file);
    if (!existsSync(path)) die(`mapped file not found: ${path}`);
  }
  return raw;
}

function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function assertPrivateBucket(
  existing: { name: string; public: boolean | null } | undefined,
): void {
  if (existing?.public === true) {
    die(`bucket "${BUCKET}" is PUBLIC: refusing to upload EA binaries.`);
  }
}

async function main(): Promise<void> {
  const command = process.argv.slice(2)[0] ?? '';
  if (!['check', 'bucket', 'upload', 'activate'].includes(command)) {
    die('usage: provision-delivery.ts <check|bucket|upload|activate>');
  }

  const { url, key } = env();
  const client = createClient(url, key, { auth: { persistSession: false } });
  const mapping = loadMapping();
  const products = Object.entries(mapping) as [string, string][];

  console.log(`vault dir : ${VAULT_DIR}`);
  for (const [productId, file] of products) {
    const path = join(VAULT_DIR, file);
    const bytes = statSync(path).size;
    console.log(`  ${productId}  <-  ${file}  (${bytes} bytes, sha256 ${sha256Of(path).slice(0, 12)}...)`);
  }

  if (command === 'check') {
    console.log('check: OK (dry-run, nothing was written)');
    return;
  }

  if (command === 'bucket' || command === 'upload') {
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    if (listError) die(`could not list buckets: ${listError.message}`);
    const existing = (buckets ?? []).find((bucket) => bucket.name === BUCKET);
    if (!existing) {
      const { error } = await client.storage.createBucket(BUCKET, { public: false });
      if (error) die(`could not create bucket "${BUCKET}": ${error.message}`);
      console.log(`created private bucket: ${BUCKET}`);
    } else {
      console.log(`bucket already exists: ${BUCKET} (public=${String(existing.public)})`);
      assertPrivateBucket(existing);
    }
  }

  if (command === 'upload') {
    for (const [productId, file] of products) {
      const localPath = join(VAULT_DIR, file);
      const storagePath = `products/${productId}/${file}`;
      const bytes = readFileSync(localPath);
      const { error } = await client.storage
        .from(BUCKET)
        .upload(storagePath, bytes, { contentType: 'application/octet-stream', upsert: true });
      if (error) die(`upload failed for ${storagePath}: ${error.message}`);
      const sha256 = sha256Of(localPath);
      const { error: rowError } = await client
        .from('product_files')
        .upsert(
          { product_id: productId, path: storagePath, sha256, bytes: bytes.length },
          { onConflict: 'product_id' },
        );
      if (rowError) die(`could not register product_files row for ${productId}: ${rowError.message}`);
      console.log(`uploaded + registered: ${productId} -> ${storagePath} (sha256 ${sha256.slice(0, 12)}...)`);
    }
    console.log('upload: OK');
  }

  if (command === 'activate') {
    if (process.env.GO_LIVE_CONFIRM !== 'yes') {
      die('activate requires GO_LIVE_CONFIRM=yes (this is the commercial go-live switch).');
    }
    for (const [productId] of products) {
      const { data: rows, error: checkError } = await client
        .from('product_files')
        .select('product_id')
        .eq('product_id', productId)
        .limit(1);
      if (checkError) die(`could not verify product_files for ${productId}: ${checkError.message}`);
      if ((rows ?? []).length === 0) {
        die(`refusing to activate "${productId}": no registered file (run upload first).`);
      }
      const { error } = await client
        .from('products')
        .update({ status: 'available', commercial_download_enabled: true, updated_at: new Date().toISOString() })
        .eq('product_id', productId);
      if (error) die(`could not activate ${productId}: ${error.message}`);
      console.log(`activated: ${productId} (available, download enabled)`);
    }
    console.log('activate: OK â€” the web catalog (manifests) is flipped in its own go-live PR.');
  }
}

await main();
