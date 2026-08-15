# V2B real-backtest audit and browser derivatives

**Scope.** This audit used the immutable source archives on branch `data/quantora-real-backtests`. They were extracted once outside the repository/public bundle at `/tmp/quantora-v2b-audit-1786488192`. Neither archive, nor the extracted CSV/JSON, is included in this application branch.

| immutable archive | SHA-256 | extracted evidence |
| --- | --- | --- |
| `STOCHEXTREME.rar` | `09cc6fd39f468a0a98cf9b18e8aabf08bb571959643d4bc84cb925e0c94f6e5d` | manifest, config, symbol specs, coverage, events, trades, minute equity |
| `Descargar First Triangle para Quantora.zip` | `ed2f3b03e9f5383ffde0c2c8ef64e8b657d2b8c43ca8c7c250c3ab10d5ba84f2` | manifest JSON, summary, branch-5 trades/equity, signals |

## StochExtreme Adaptive — AMP SEA2575

- **Run:** `SEA2575_AMP_@ENQ_1754006400`; status `COMPLETED`; warnings `none`.
- **Public market:** Nasdaq-100. **Historical instrument:** `AMP @ENQ` (never relabelled USTEC). Broker/server: AMP Global Clearing LLC / `AMPGlobalUSA-Live`; USD account.
- **Coverage:** 2025-08-01 00:00:00 to 2026-08-07 20:59:59 UTC; 509,489,041 ticks; warmup complete; 12,228 work bars.
- **Exact configuration:** v1.07, `LIVE_INTRABAR`, `Q_PINE_INTRABAR_ORIGIN`, `TESTER_ORDERS`, M30/M3, ATR 14, baseline 2200, confirm 60 seconds, 0.10 volume, 100-point stop (400 ticks), server offset UTC+0, New York conversion with US DST enabled. Allowed ET `03:00–11:30|14:00–18:00`; blocked `11:30–14:00|18:00–03:00`.
- **Validation:** 421 unique/chronologically ordered trades and position IDs, one run ID; 361,248 unique/ordered equity points. Reconciled trade net P&L **$6,582.00** and R **32.91** to manifest controls; full equity worst peak-to-valley drawdown **$4,690.00** (peak $17,676; valley $12,986), matching the official absolute DD. Final equity $16,582.00 and no active position.
- **Structural/economic:** 200 structural wins and 221 structural losses. Structural classification is source `structural_outcome`, not a P&L inference: BUY WIN occurs only at `TARGET_K80_M30_CLOSE` (upper extreme), SELL WIN only at `TARGET_K20_M30_CLOSE` (lower extreme), and LOSS only at final `SL` under the configured 100-point stop. Actual price moves vary because of spread/slippage and are not used to recategorize a trade. Economic results: 190 profit / 231 loss.

## First Triangle Adaptive — selected branch 5 only

- **Run:** `QUANTORA_FIRST_TRIANGLE_FINAL15_@ENQ_1754006400`; every delivered trade has `branch_id=5`. No other candidate branch is reconstructed or published.
- **Configuration:** `FIRST_ALTERNATING_TRIANGLE` / `FIXED_200PTS` / `ADAPTIVE_MFE_GIVEBACK`; `open_at_end=false`.
- **Validation:** 145 unique and chronological trades/equity points; $6,687.50 net and 17.15375 R reconcile to the supplied summary, along with PF 1.255930 and expectancy $46.120690. The official maximum drawdown is **$4,474.80 MTM**. The separately calculated **closed-trade-only** equity drawdown is **$4,151.50**; no intratrade path is claimed or invented.

## Browser derivative and reduction

`scripts/generate-v2b-real-data.mjs` parses and validates extracted evidence, then writes `src/generated/real-backtests.ts`. It rejects missing required columns, malformed numbers/times, invalid run IDs, non-branch-5 triangle rows, duplicates, ordering failures, status/warning controls, P&L/R/DD reconciliation failures, and Stoch structural-rule failures.

- Trade logs are retained in full: 421 Stoch + 145 First Triangle branch-5 rows.
- First Triangle equity is unchanged: **145 → 145** points.
- Stoch minute equity is conservatively reduced: **361,248 → 1,197** points. Algorithm: uniform representative points plus first/last, global high/low, worst-DD peak/valley/recovery and every trade-id transition. This preserves the critical DD path and trade-state changes while avoiding runtime extraction or a multi-megabyte public CSV.
- The generated file is consumed by distinct `stochExtremeAmpSea2575` and `firstTriangleBranch5` adapters. It drives real equity/drawdown, monthly USD heatmaps, real trade logs, USD/R tooltips, direction/duration/streak/range analysis and day-based top-5/top-10 concentration.

## Limitations

Historical results do not predict future performance. `Owner Supplied` is evidence provenance; the public source label is `Historical Backtest`. No authentication, payments, licensing, bot delivery, live trading, or synthetic market data is introduced. First Triangle intratrade drawdown is unavailable; only its official MTM control and clearly labelled closed-trade calculation are shown.
