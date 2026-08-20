# Real data import (Phase 2A)

This repository currently has a frontend-only catalog. Phase 2A adds versioned domain contracts and a pure importer; it does **not** run a backend, create strategies, or claim that the existing demo metrics are real.

> **Strategy intake (QNT-0003):** new strategies are now added through the
> data-driven manifest pipeline in `docs/STRATEGY_INTAKE.md` (folders
> `strategy-intake/` and `public-strategies/`). The JSON/CSV importer documented
> below remains available for raw domain datasets.

## Source separation and status

- Existing UI records remain mock Phase 1 fixtures in `src/data.ts`.
- Future owner deliveries belong outside mock fixtures, in the intake pipeline's `strategy-intake/incoming/` and `public-strategies/` folders. Never copy owner data into mock files.
- Every real record must carry `provenance.dataStatus: "real"`; mock fixtures must carry `"mock"`. The UI should show a clear status guardrail before presenting any imported record.
- Every `Strategy` must also carry `validationStatus`, one of: `mock`, `owner_supplied_under_review`, `quantora_validated`, or `rejected`. It is independent from `provenance.dataStatus` and the operational `status` field.
- Allowed combinations: `dataStatus: "mock"` pairs with `validationStatus: "mock"`; `dataStatus: "real"` pairs with `owner_supplied_under_review`, `quantora_validated`, or `rejected`. For example, a real owner delivery awaiting review uses `dataStatus: "real"` with `validationStatus: "owner_supplied_under_review"`.
- `src/domain/catalog.ts` provides a selective ID-based overlay: only matching mock IDs are replaced, while all other mock records stay unchanged.

## JSON dataset format

The top-level object must use `modelVersion: "1.0"` and these arrays: `strategies`, `assets`, `backtests`, `equityCurves`, and `tradeLogs`. IDs are globally unique. Dates/times are ISO-8601 strings and numeric fields are JSON numbers (not formatted percentages). A strategy can reference multiple `assetIds`.

Minimal illustrative fixture (not real performance data):

```json
{
  "modelVersion": "1.0",
  "strategies": [{
    "id": "example-strategy",
    "name": "Example owner strategy",
    "version": "1.0.0",
    "status": "active",
    "validationStatus": "mock",
    "assetIds": ["asset-example"],
    "backtestIds": ["backtest-example"],
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z",
    "provenance": {"dataStatus":"mock", "sourceName":"Documentation fixture", "sourceType":"fixture"}
  }],
  "assets": [{"id":"asset-example","symbol":"EXAMPLE","name":"Example asset","assetClass":"other"}],
  "backtests": [], "equityCurves": [], "tradeLogs": []
}
```

## CSV format

Use one CSV file per entity (`strategies`, `assets`, `backtests`, `equityCurves`, or `tradeLogs`). The first row is a header; values containing arrays (such as `assetIds`, `tradeLogIds`, or `points`) are JSON strings. The importer supports numeric columns including `quantity`, `entryPrice`, `exitPrice`, `fees`, `pnl`, `equity`, `drawdown`, `balance`, and `initialCapital`. This deliberately simple parser expects comma-separated values without embedded commas.

Example `assets.csv`:

```csv
id,symbol,name,assetClass,provenance
asset-example,EXAMPLE,Example asset,other,"{\"dataStatus\":\"mock\",\"sourceName\":\"Documentation fixture\",\"sourceType\":\"fixture\"}"
```

## How to validate

Call `importJson(text)` or `importCsv(entity, text)` from `src/domain/importer.ts`. Results contain either a typed dataset or readable `{ path, message }` errors. Run `bun run build` after adding a delivery. No file upload, persistence, authentication, licensing, payment, bot, email, or admin workflow is enabled.

## What the owner must provide

For each of 1–2 strategies: stable strategy ID/name/version; associated asset IDs and symbols (including exchange and quote currency when relevant); backtest period, timeframe, initial capital and currency; complete equity curve with timestamp and equity (and units); metrics with definitions and calculation period; complete trade log with side, timestamps, quantity, prices, fees, P&L and currency; and provenance (source filename, source system, received date, timezone, and whether values are net/gross of fees). Missing metrics should be omitted, not estimated. Confirm permission to use the supplied data and any redaction requirements.
