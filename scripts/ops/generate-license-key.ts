/**
 * QNT-0044 · License key generator (mirrors sources/LicenseGuard.mqh).
 *
 * Key = SHA256(secret + "|" + accountLogin), lowercase hex.
 * The secret lives only in your build/provisioning environment — never in Git.
 *
 * Usage: bun run scripts/ops/generate-license-key.ts <accountLogin>
 * Env:   QNT_LICENSE_SECRET (must match the value compiled into the .ex5)
 */
import { createHash } from 'node:crypto';

const secret = process.env.QNT_LICENSE_SECRET ?? '';
const account = (process.argv.slice(2)[0] ?? '').trim();

if (secret.length === 0) {
  console.error('error: set QNT_LICENSE_SECRET (the same value compiled into the .ex5).');
  process.exit(1);
}
if (!/^\d{4,12}$/.test(account)) {
  console.error('error: pass the MT5 account login as the only argument (digits only).');
  process.exit(1);
}

const key = createHash('sha256').update(secret + '|' + account).digest('hex');
console.log(key);
