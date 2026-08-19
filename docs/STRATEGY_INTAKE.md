# Strategy intake (QNT-0003)

Quantora adds strategies through a **data-driven pipeline**, not through code.
A new strategy is a folder with a JSON **manifest** (plus optional evidence
files). The pipeline validates it, hashes its evidence, and builds a normalized
catalog. No TypeScript, routes, or components change when a strategy is added.

## 1. How to create a strategy folder

Use `strategy-intake/incoming/` as the drop zone. Each strategy gets one
manifest file named `<strategy-id>.manifest.json`:

```
strategy-intake/incoming/
  ustec-liquidity-sweep-order-block-explorer-v1.manifest.json
  evidence/
    rules-summary.md
```

Start from the empty template in `strategy-intake/templates/manifest.template.json`.

## 2. How to fill the manifest

The manifest has two parts:

- **Documentary metadata** (top-level fields): `strategyId`, `tagline`, `type`,
  `rules`, `limitations`, `costs`, `variant`, `configuration`, `evidence`.
- **The domain dataset** (`dataset`): the existing `QuantoraDataset` contract
  (`strategies`, `assets`, `backtests`, `equityCurves`, `tradeLogs`). Reuse the
  contracts in `src/domain/types.ts` — do not invent new fields.

Rules:

- `strategyId` must match `dataset.strategies[0].id`.
- A manifest contains **exactly one** strategy.
- `dataset.strategies[0].validationStatus` must be one of `mock`,
  `owner_supplied_under_review`, `quantora_validated`, or `rejected`.
- `dataStatus: "mock"` pairs only with `validationStatus: "mock"`.
- `dataStatus: "real"` pairs with `owner_supplied_under_review`,
  `quantora_validated`, or `rejected`.
- Leave absent fields absent. Do **not** write `0`, `""`, or fake arrays to pass
  the validator. Missing metrics stay missing; they are never estimated.

A strategy can be **documentary only** (identity + provenance, no results): just
leave `backtests`, `equityCurves`, and `tradeLogs` empty. Results (`period`,
`metrics`, equity, trades) are added only when real evidence exists.

## 3. Where to put evidence

Reference files in the manifest's `evidence` array with a relative path. Files
may sit next to the manifest or under `public-strategies/datasets/`. The
pipeline reads each file, computes its SHA-256, and stores the hash — it never
copies the file into the catalog.

```json
"evidence": [
  { "file": "evidence/rules-summary.md", "kind": "rules", "classification": "public" },
  { "file": "evidence/source.mq5", "kind": "source", "classification": "private" }
]
```

## 4. What is public vs. private

- `public` evidence is exposed in the catalog by **name + hash** only.
- `private` evidence is exposed by **hash + kind** only (never its name, path, or
  contents).
- These extensions are **forbidden in the public output** no matter what:
  `.mq4`, `.mq5`, `.ex4`, `.ex5`, `.set`, `.env`, `.pem`, `.key`, `.crt`,
  `.p12`, `.pfx`. Marking such a file `public` is a blocking error.
- Credentials, secrets, local filesystem paths, and private evidence never
  reach the catalog.

## 5. How to run the pipeline

```bash
bun run strategies:validate   # validate incoming + accepted manifests
bun run strategies:build      # build public-strategies/catalog.json
bun run strategies:report     # write strategy-intake/reports/*.md|json
bun run strategies:intake     # full pipeline: validate -> hash -> catalog -> reports
bun run strategies:ingest     # re-import First Triangle + StochExtreme sources into their manifests
bun run strategies:ingest:first-triangle
bun run strategies:ingest:stochextreme
```

`strategies:intake` is the one to run after dropping a new manifest. The
generated public catalog is `public-strategies/catalog.json` (committed as the
versioned dataset the app reads); the internal report (including statuses and
evidence hashes) lands in `strategy-intake/reports/` and is gitignored.

## 6. How to interpret errors and warnings

- **Blocking errors** (`level: "error"`): the manifest is not accepted, no
  catalog entry is produced for it, and the command exits with a non-zero code.
  Fix them before proceeding.
- **Warnings** (`level: "warning"`): optional information only (for example a
  documentary strategy with no results, or a missing `tagline`). They never
  block the pipeline.

## 7. How to add ten strategies without touching code

Create ten manifest files (one per strategy), drop them in
`strategy-intake/incoming/`, and run `bun run strategies:intake`. The catalog
grows to include all ten. No component, route, or contract changes are needed.

## 8. How a strategy stays Under Review

A real owner delivery awaiting Quantora review uses:

```json
"validationStatus": "owner_supplied_under_review",
"provenance": { "dataStatus": "real", "sourceName": "...", "sourceType": "owner-delivery" }
```

Under Review means the owner supplied rules, code, or results, but Quantora has
not yet independently reproduced them. It is **not** promoted automatically.

## 9. What is missing for Quantora Validated

`quantora_validated` is assigned only after Quantora independently reproduces
the strategy from its evidence, and only by an explicit editorial decision from
Javier and M365 Copilot. It is never inferred, never defaulted, and never
auto-assigned by the pipeline.

## 10. Faithful `results` for real owner deliveries

The Phase 2A domain dataset requires fields the owner's broker export does not
carry verbatim (`backtests[].initialCapital`, `backtests[].timeframe`, and
`tradeLogs[].quantity`). Writing absent values as zero would violate the
"never fabricate" rule, so a real delivery keeps **identity + provenance** in
the strict `dataset`, and its **period, metrics, equity points and evidence
completeness** in an optional `results` block:

```json
"results": {
  "period": { "start": "2025-08-14T01:30:00Z", "end": "2026-08-07T13:16:28Z" },
  "metrics": { "profitFactor": 1.25593, "trades": 145, "winRate": 51.03, "netUsd": 6687.50 },
  "equity": [ { "timestamp": "2025-08-14T01:30:00Z", "equity": 88.8, "drawdown": 0 } ],
  "evidenceComplete": 1
}
```

`results.metrics` and `results.equity` are extracted or calculated from the
source files by an importer (`scripts/intake/ingest-first-triangle.ts` and
`scripts/intake/ingest-stochextreme.ts`); they are never hand-typed into
components. This is the documented QNT-0002F incompatibility: the strict domain
contract is reused where the source maps 1:1, and the faithful `results` block
covers the fields it cannot represent.

The StochExtreme importer counts **only the 421 closed trades** in its trade
log. Crosses, confirmations, cancelled signals and `SESSION_BLOCKED` events
live in the events file and are never counted as trades.

## 11. Quantora Score

Every strategy with results gets a common, data-driven 0-100 score computed by
`scripts/intake/scoring.ts`. It is never tuned per strategy. Components and
weights:

| Component | Weight |
| --- | --- |
| Profit Factor | 25% |
| Drawdown vs result | 25% |
| Equity stability (R² of the equity curve) | 15% |
| Trade count | 10% |
| Temporal consistency (months covered) | 10% |
| Frequency | 5% |
| Costs | 5% |
| Evidence completeness | 5% |

Profit Factor tiering is a general rule: the minimum publishable PF is **1.15**
(enforced by the filter), and a PF of **1.20 or higher** is the *favorable*
tier, earning a documented +5 bonus on the Profit Factor component (capped at
100).

The final score is a weighted average over the **available** components. A
missing component is excluded (neutral) and reduces the reported `confidence`;
it is never invented. Drawdown is measured relative to net result, so a large
drawdown visibly lowers the score without acting as an automatic blocker.

## 12. Publication filter and public catalog

The reusable filter in `scripts/intake/filter.ts` gates the **public** catalog.
A real strategy must have a name, a Profit Factor of at least **1.15**, at least
one closed trade, and an equity curve with at least two points. A Profit Factor
of **1.20 or higher is not mandatory** — it is simply treated as the more
favorable tier by the Quantora Score. Drawdown is **not** a blocking rule yet.
`bun run strategies:intake` writes only the strategies that pass to
`public-strategies/catalog.json`, and strips every internal state
(`dataStatus`, `validationStatus`, `status`) plus evidence hashes before that
file is written. "Owner Supplied" / "Under Review" therefore never reach the UI.
