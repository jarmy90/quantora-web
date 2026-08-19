/**
 * QNT-0003 strategy intake CLI.
 *
 * Commands (invoked through the `strategies:*` package scripts):
 *   validate  validate incoming + accepted manifests, non-zero on blocking errors
 *   build     build the normalized catalog from accepted manifests (+ mocks)
 *   report    write human + machine-readable reports
 *   intake    full pipeline: discover -> validate -> hash -> privacy -> catalog -> report
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { strategies as mockStrategies } from '../src/data.ts';
import {
  buildCatalog,
  exitCodeFor,
  mockStrategyToCatalogEntry,
  processDirectory,
  renderHumanReport,
  renderMachineReport,
  type CatalogEntry,
  type IntakeSummary,
  type ManifestIssue,
  type ProcessedManifest,
} from './intake/pipeline.ts';

const ROOT = process.cwd();
const INCOMING_DIR = resolve(ROOT, 'strategy-intake/incoming');
const MANIFESTS_DIR = resolve(ROOT, 'public-strategies/manifests');
const REPORTS_DIR = resolve(ROOT, 'strategy-intake/reports');
const CATALOG_PATH = resolve(ROOT, 'public-strategies/catalog.json');

function mockEntries(): CatalogEntry[] {
  return mockStrategies.map(mockStrategyToCatalogEntry);
}

function summarize(manifests: ProcessedManifest[]): {
  catalog: CatalogEntry[];
  issues: ManifestIssue[];
  warnings: ManifestIssue[];
} {
  const realEntries = manifests
    .filter((manifest): manifest is ProcessedManifest & { entry: CatalogEntry } => manifest.entry !== null)
    .map((manifest) => manifest.entry);

  const { catalog, issues } = buildCatalog(mockEntries(), realEntries);
  const allIssues = [...manifests.flatMap((manifest) => manifest.issues), ...issues];
  const warnings = manifests.flatMap((manifest) => manifest.warnings);
  return { catalog, issues: allIssues, warnings };
}

function toSummary(result: ReturnType<typeof summarize>): IntakeSummary {
  return {
    generatedAt: new Date().toISOString(),
    strategyCount: result.catalog.length,
    issues: result.issues,
    warnings: result.warnings,
    catalog: result.catalog,
  };
}

function writeCatalog(catalog: CatalogEntry[]): void {
  mkdirSync(dirname(CATALOG_PATH), { recursive: true });
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
}

function writeReports(summary: IntakeSummary): void {
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(join(REPORTS_DIR, 'intake-report.md'), renderHumanReport(summary) + '\n');
  writeFileSync(join(REPORTS_DIR, 'intake-report.json'), renderMachineReport(summary) + '\n');
}

function printResult(label: string, issues: ManifestIssue[], warnings: ManifestIssue[]): void {
  console.log(`[${label}] blocking errors: ${issues.length}`);
  for (const issue of issues) console.error(`  [error] ${issue.path}: ${issue.message}`);
  console.log(`[${label}] warnings: ${warnings.length}`);
  for (const issue of warnings) console.log(`  [warn] ${issue.path}: ${issue.message}`);
}

function usage(): void {
  console.log('Usage: bun run scripts/strategy-intake.ts <validate|build|report|intake>');
}

const command = process.argv.slice(2)[0];

switch (command) {
  case 'validate': {
    const accepted = processDirectory(MANIFESTS_DIR);
    const incoming = processDirectory(INCOMING_DIR);
    const issues = [...accepted.issues, ...incoming.issues];
    const warnings = [...accepted.warnings, ...incoming.warnings];
    console.log(`Manifests validated: ${accepted.manifests.length} accepted + ${incoming.manifests.length} incoming`);
    printResult('validate', issues, warnings);
    process.exit(exitCodeFor(issues));
    break;
  }
  case 'build': {
    const accepted = processDirectory(MANIFESTS_DIR);
    const result = summarize(accepted.manifests);
    if (result.issues.length === 0) {
      writeCatalog(result.catalog);
      console.log(`Catalog written to public-strategies/catalog.json (${result.catalog.length} strategies)`);
    }
    printResult('build', result.issues, result.warnings);
    process.exit(exitCodeFor(result.issues));
    break;
  }
  case 'report': {
    const accepted = processDirectory(MANIFESTS_DIR);
    const result = summarize(accepted.manifests);
    writeReports(toSummary(result));
    console.log(`Reports written to strategy-intake/reports/ (${result.catalog.length} strategies)`);
    printResult('report', result.issues, result.warnings);
    process.exit(exitCodeFor(result.issues));
    break;
  }
  case 'intake': {
    const accepted = processDirectory(MANIFESTS_DIR);
    const incoming = processDirectory(INCOMING_DIR);
    const manifests = [...accepted.manifests, ...incoming.manifests];
    const result = summarize(manifests);
    if (result.issues.length === 0) {
      writeCatalog(result.catalog);
      console.log(`Catalog written to public-strategies/catalog.json (${result.catalog.length} strategies)`);
    }
    writeReports(toSummary(result));
    console.log(`Intake processed: ${accepted.manifests.length} accepted + ${incoming.manifests.length} incoming`);
    printResult('intake', result.issues, result.warnings);
    process.exit(exitCodeFor(result.issues));
    break;
  }
  default:
    usage();
    process.exit(2);
}
