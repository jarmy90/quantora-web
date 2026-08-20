# First Triangle Gold Adaptive — evidence

## Source

- Archive: `OROM15.zip` (ZIP, 771,475 bytes)
- Branch: `data/quantora-real-backtests`
- Path: `data/imports/quantora-real-backtests/OROM15.zip`
- Archive SHA-256: `816812315e82e067b2dfd42144b722c2cc73b231e674398a6bb71f2e05467476`
- Source commit: `2dc5733bf3c2d0c5fe549d418530f6ce70644ecf`
- Run id: `FIRST_TRIANGLE_GOLD_EVIDENCE_XAUUSD_1751328000`
- Strategy: First Triangle Gold Adaptive · explorer version `3.00` (config `research-v3`)
- Market: XAUUSD (Gold vs US Dollar) · M15 · broker IC Markets (server placeholder `SET_EXACT_SERVER`)
- Selected variant: `variant_id = 174` of 378 · `cost_scenario = BASE` · SL 55 / activation 60 / distance 25
- Modeling mode: Every tick based on real ticks

## Files committed here (derivatives, renamed from the archive)

| File | Kind | Notes |
| --- | --- | --- |
| `first_triangle_gold_manifest.json` | manifest | Identity, selected variant, configuration, drawdown definition, warnings. |
| `first_triangle_gold_strategy_config.csv` | config | Entry/exit model, stops, trailing, session, lot, cost models, tester mode. |
| `first_triangle_gold_symbol_specifications.csv` | source | Broker/symbol/point/tick facts (IC Markets, XAUUSD). |
| `first_triangle_gold_coverage.csv` | source | Period, open-at-end flag, data source, drawdown definition. |
| `first_triangle_gold_summary.csv` | summary | 378 variants × metrics in points; row `variant_id=174` is the selected one. |
| `first_triangle_gold_trades.csv` | trades | 76,356 rows: closed-trade log for ALL 378 variants (points). Variant 174 → 203 closed trades. |
| `first_triangle_gold_equity.csv` | equity | 203 closed-trade equity points for variant 174 (points; USD columns are `NA`). |
| `first_triangle_gold_monthly.csv` | monthly | Per-variant monthly buckets (trades + net points). |
| `first_triangle_gold_periods.csv` | periods | DEVELOPMENT / VALIDATION / LOCKED_OOS / H1 / H2 / ALL per variant. |
| `first_triangle_gold_robustness_surface.csv` | robustness | One row per variant (378) — research evidence, not part of the public card. |
| `source-archive.sha256` | integrity | SHA-256 of the original `OROM15.zip` (verified by the importer). |

Full originals (raw archive and all raw CSVs) are kept out of git. The archive
is recorded by hash only; the derived files above are byte-identical copies of
the files inside `OROM15.zip` (renamed to a stable scheme).

## Trade-counting rule

Only rows with `variant_id = 174` and `cost_scenario = BASE` in
`first_triangle_gold_trades.csv` are counted: **203 closed trades** (18
`INITIAL_SL`, 113 `OPPOSITE_TRIANGLE`, 72 `TRAILING`). The package declares one
position open at the end (`open_at_end = true`) that is **not** present as a row
in the trade log and is never counted as a closed trade, win, loss or equity
point.

There are no signals, crosses, confirmations or cancelled events to exclude in
this export — the trade log contains only closed logical trades.

## Metrics (variant 174, BASE, in points)

- Closed trades: 203 · wins: 102 · losses: 101 · breakevens: 0 (203 = 102+101+0)
- Profit Factor: 1.8971348495464608
- Gross profit: 5,009.10 pts · gross loss: 2,640.35 pts · net: 2,368.75 pts
- Max closed-trade drawdown: 176.45 pts
- Expectancy: 11.6115 pts/trade (source summary: net ÷ exported count 204, which includes the open position)
- Win rate: 50.0% (source summary: wins ÷ exported count 204)
- Period: 2025-07-01 01:00:00 → 2026-08-14 23:56:59
- Positive months (monthly buckets): 10 of 12 with closed trades (months 9 and 12 negative)
- DEVELOPMENT 87 + VALIDATION 51 + LOCKED_OOS 65 = 203 (H1 138 + H2 65 = 203)

**Costs**: the export reports commission 0.0 / slippage 0.0 and the manifest
warns "USD fields unavailable until broker costs are reconciled". Costs were
**not applied** → `costsApplied = false`; the zero figures are not interpreted
as confirmed real costs. All results stay in **points** — no USD conversion.

Historical results do not predict future performance.
