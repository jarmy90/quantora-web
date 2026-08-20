# StochExtreme Adaptive — evidence

## Source

- Archive: `STOCHEXTREME.rar` (RAR 5, 4,454,426 bytes)
- Branch: `data/quantora-real-backtests`
- Archive SHA-256: `09cc6fd39f468a0a98cf9b18e8aabf08bb571959643d4bc84cb925c0e94f6e5d`
- Run id: `SEA2575_AMP_@ENQ_1754006400`
- Strategy version: `1.07`
- Market: Nasdaq-100 · historical instrument: AMP @ENQ

## Files committed here (web derivatives)

| File | Kind | Notes |
| --- | --- | --- |
| `stochextreme_manifest.csv` | summary | Run summary: closed trades, PF, net, drawdown. |
| `stochextreme_strategy_config.csv` | config | Entry/exit model and session rules. |
| `stochextreme_symbol_specifications.csv` | source | Broker/symbol/point-value facts. |
| `stochextreme_coverage.csv` | source | Tick/warmup period coverage. |
| `stochextreme_trades.csv` | trades | 421 closed trades (the only trades counted). |
| `stochextreme_equity_daily.csv` | equity | Daily-downsampled mark-to-market equity (derived, 354 points, includes the 4,690.00 USD max-drawdown point). |

Full originals kept out of git (recorded by hash only):

- `Quantora_SEA2575_AMP_@ENQ_1754006400_equity.csv` — 44,304,873 bytes, SHA-256 `1ced590f8510039b5171e06b67f76360f20196de31aa5172115d59884c109e78`
- `Quantora_SEA2575_AMP_@ENQ_1754006400_events.csv` — 10,400,573 bytes, SHA-256 `29e6abea74a5efaea45d239496884d1a9c6caf088eb2e0bfb78073ffe49dd742`

## Trade-counting rule

Only the 421 rows in `stochextreme_trades.csv` (each with a `POSITION_CLOSED`
event counterpart) are counted as trades. The following event types are
explicitly **not** trades and are never counted:

- `BUY_CROSS` (5,402) and `SELL_CROSS` (6,618)
- `CONFIRMATION_STARTED` (12,020), `CONFIRMATION_PASSED` (8,833), `CONFIRMATION_CANCELLED` (3,186)
- `SESSION_BLOCKED` (8,412)

The importer (`scripts/intake/ingest-stochextreme.ts`) reads the trade log only
and ignores crosses, confirmations, cancelled signals and blocked sessions.

## Metrics

Computed from the 421 closed trades (net P&L per trade), cross-checked against
the source manifest:

- Closed trades: 421
- Economic wins (net P&L > 0): 190 · losses: 231 → win rate 45.1306%
- Structural wins: 200 · structural losses: 221 (source `structural_*` fields)
- Profit Factor: 1.151392131381321
- Net P&L: 6,582.00 USD
- Expectancy: 15.6342 USD/trade
- Max drawdown: 4,690.00 USD (26.5332%), 2026-06-30 11:53
- Commission/swap: 0.00 per trade (not applied in this export)
- Period: 2025-08-01 → 2026-08-07

Historical results do not predict future performance.
