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
```

`strategies:intake` is the one to run after dropping a new manifest. The
generated catalog is `public-strategies/catalog.json`; reports land in
`strategy-intake/reports/`.

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
