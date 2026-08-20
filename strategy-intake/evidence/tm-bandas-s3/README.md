# tm-bandas-s3 — intake evidence

Private, versioned derivatives for the **TM Bandas S3** strategy intake (QNT-0007).

## Source

- Repository: `jarmy90/quantora-web`
- Branch: `data/quantora-real-backtests`
- Path: `data/imports/quantora-real-backtests/bandas.zip`
- Commit: `24c161929325679bbf6f14a0a079b331a2cd7f5e` ("Add files via upload", 2026-08-20 14:21:46 +0200)
- Size: 25,696 bytes
- SHA-256: `455294f995ede782880b847755828dc07e2b0ef4642040bca754c49f30b67f21`

The archive itself is **not** committed to `main` and is **not** part of the public bundle. Its digest is recorded in `source-archive.sha256` and verified by the importer.

## Derivatives

Each file below was extracted from `bandas.zip` and renamed only — the byte content is preserved verbatim (CRLF line endings intact). They are the private source evidence for reproducible ingestion and are never exposed in `public-strategies/catalog.json`.

| File | Role | Classification |
|---|---|---|
| `bandas_write_test.csv` | Export write/format self-test (`WRITE_OK`) | private |
| `bandas_manifest.csv` | Run metadata (identity, symbol, timeframe, variant, unit spec) | private |
| `bandas_parameters.csv` | Strategy parameters (rails, ATR, stop/target) | private |
| `bandas_trades.csv` | Closed-trade log (621 trades) | private |
| `bandas_summary.csv` | Closed-run summary (PF, net, drawdown) | private |
| `bandas_monthly.csv` | Monthly breakdown (12 months) | private |
| `bandas_validation.csv` | Source self-checks (all `pass`) | private |

## Discovery report

### Identity (VERIFIED from `bandas_manifest.csv`)

- Internal `strategy_id`: `tm-bandas-s3-keeper`
- `strategy_version`: `1.00`
- `run_id`: `tm-bandas-s3_1.00_USTEC_1751328000_KEEPER_SL12_TP36`
- `symbol`: `USTEC` · `timeframe`: `M1`
- `variant`: `KEEPER_SL12_TP36`
- `entry_logic`: `S3_ABOVE_TO_UPPER_RETURN`
- `opens_real_orders`: `false` (research explorer)

### Identity decision

- **strategyId** = `tm-bandas-s3` — the stable system identity from the source `run_id` (`tm-bandas-s3_…`). The source's own `strategy_id` field is variant-qualified (`tm-bandas-s3-keeper`); `keeper` is part of the declared `Variant` (`KEEPER_SL12_TP36`), so it is kept in `variant`, not in the id.
- **name** = `TM Bandas S3` — taken verbatim from the source system id `tm-bandas-s3` ("bandas" = Spanish for "bands"), **not** from the ZIP filename.
- **modelId** = `tm-bandas-s3` (internal; never exposed in the public bundle).

### Environment (VERIFIED / DERIVED / NOT_AVAILABLE)

- Asset: `USTEC` → normalized market **Nasdaq-100** (VERIFIED symbol; DERIVED public market name)
- Asset class: index CFD → `other` (DERIVED)
- Broker: **IC Markets** (VERIFIED from notes/symbol context)
- Server: NOT_AVAILABLE
- Timeframe: `M1` (VERIFIED)
- Modeling mode: NOT_AVAILABLE (source exports pre-computed trades)
- Initial capital: **10,000.00 USD** (VERIFIED — manifest + summary agree)
- Currency: **USD** (VERIFIED — `money_per_index_point: 2.00`, gross/net P&L reconcile to USD)
- Lot: `0.10` · tick size `0.10` · money per index point `2.00` (VERIFIED)
- Timezone: **UTC** — every source timestamp carries an explicit `+00:00` offset (VERIFIED as source-declared; preserved verbatim, no re-normalization)

### Period (DERIVED)

- Source manifest `start_utc` `2024-01-02` / `end_utc` `2026-08-19` are the data window.
- Effective closed-trade period: `2025-09-01` → `2026-08-19` (first trade entry → last trade exit). The public period uses the effective trade range.

### Variant selection

- The source declares a single selected variant `KEEPER_SL12_TP36` (all 621 trades are that variant). No multi-variant sweep, no OOS optimization. Selection is VERIFIED, not re-derived.

### Trades (reconciled from `bandas_trades.csv`)

- 621 closed trades = 228 winners + 393 losers + 0 breakevens ✓
- All `sell` (short-only) · all `closed` · all `costs_included=false`
- Exit reasons: 228 TP / 393 SL
- Gross profit `16,416.00` / gross loss `9,432.00` / net `6,984.00`
- Profit Factor `1.74045802` · win rate `36.71497584%` · expectancy `11.24637681 USD`
- Open positions at end: `0` (VERIFIED — summary `open_at_end: 0`; no open-position exclusion needed)

### Equity (DERIVED)

- No equity file is included in the archive. The closed-trade equity curve is reconstructed by cumulating `net_pnl` from initial capital `10,000.00` over the 621 closed trades (621 points).
- Final balance `16,984.00` ✓ and max closed-trade drawdown `384.00 USD` ✓ both reconcile to the summary.

### Costs (VERIFIED as "not applied")

- Every trade has `costs_included=false`, `commission=0`, `fees=0`; summary `commission_total=0`, `fees_total=0`.
- The `0.00` values are **not** confirmed real costs → `costsApplied=false`.

### NOT_AVAILABLE / omitted

- No equity/balance file, no tick data, no signals/events file, no `.set`/`.mq5`/`.ex5`, no MT5 report, no DEV/VAL/OOS split.
- Nothing is fabricated; absent fields stay absent.

## Omitted files

- `bandas.zip` itself (stays on the data branch; digest only is recorded here).
- No local paths, credentials, or private source paths are committed.
