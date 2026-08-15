# Quantora — Phase 1 catalog and V2B performance analytics UX

Premium fintech UI for discovery and evaluation of MetaTrader 5 algorithmic strategies. Built with TanStack Start, React, Vite, Tailwind and strict TypeScript. This is a **Phase 1 interface**: it does not provide trading, licensing, payments, authentication, strategy validation or automatic publication.

## V2B scope completed

V2B closes the performance-analytics presentation layer without manufacturing historical evidence:

- Detail-page tabs: Overview, Performance, Trades, How it works and Evidence.
- Reusable SVG charts and modules for equity, drawdown, monthly returns, trade log, P&L distribution, direction, duration, concentration and streaks.
- An explicit `Structural vs. Economic` presentation for StochExtreme: rule-based WIN/LOSS facts are separate from post-cost P&L.
- Owner-supplied aggregate metrics continue to be rendered verbatim for real profiles.
- If discrete evidence is absent, series-dependent modules render a neutral pending state; they never draw an invented equity curve, drawdown, heatmap or trade log for a real strategy.
- CSV preview parser in the local publish wizard. It validates a pasted CSV in the browser only and does not upload or activate a dataset.
- Analytics interaction events remain anonymous/local interface telemetry; no third-party collector or sensitive data is added.

Legacy demo profiles can render their pre-existing illustrative curve only as **Mock demo**. That path is intentionally separate from real historical data.

## Data status and provenance

| Item | Status in this repository | Product behavior |
| --- | --- | --- |
| First Triangle Adaptive aggregate metrics | Owner-supplied aggregate values in the typed catalog | Displayed with `real` provenance; no invented series |
| StochExtreme Adaptive aggregate metrics and structural facts | Owner-supplied aggregate values/facts in the typed catalog | Displayed with `real` provenance; structural and economic outcomes separated |
| `trades.csv` | **Not present** | Trade log, distribution, direction, duration, concentration and streak modules remain pending for real profiles |
| `equity.csv` | **Not present** | Equity, drawdown and monthly-return modules remain pending for real profiles |
| `manifest.csv`, `coverage.csv`, `strategy_config.csv`, `events.csv`, `symbol_specifications.csv` | **Not present** | No claim of imported coverage/configuration/event/specification evidence |
| Screenshots/captures of real backtests | **Not present** | No screenshot-backed performance assertion is made |

The workspace was inspected on **August 11, 2026**: there are no CSV datasets under `/home` outside dependencies, and no real CSV has been imported or activated. Consequently, **this release does not claim to show real equity history**. The exact limitation is exposed in `src/domain/stochextreme-facts.ts` through `STOCHEXTREME_DATASET_STATUS` and in the real-strategy evidence UI.

See `docs/REAL_DATA_IMPORT.md` for the Phase 2A import contracts. Supplying the listed files is required before real time-series analytics can be populated.

## Architecture

- `src/domain/product.ts` — single typed source of strategy profiles, provenance, aggregate metrics and factual profile notes.
- `src/domain/analytics.ts` — pure types and calculations for trades, equity series, summaries, filtering, aggregation and evidence status.
- `src/domain/strategy-analytics.ts` — provenance boundary: real profiles pass aggregate data through with pending series; mock fixtures alone may use illustrative curves.
- `src/domain/csv-import.ts` — defensive CSV parsing, entity detection and preview limits. It does not persist data.
- `src/domain/stochextreme-facts.ts` — rule/economic definitions and the explicit missing-dataset status.
- `src/components/charts.tsx` — reusable visual components with neutral empty/pending states.
- `src/routes/strategies.$id.tsx` — strategy evidence experience and tabbed analytics UX.
- `src/routes/publish.tsx` — local draft flow plus client-side CSV preview only.
- `src/domain/__tests__/analytics.test.ts` — domain and CSV parser tests.

The existing Phase 1 catalog, comparator, matcher, favorites, drafts and demo admin surfaces remain modular. Local persistence is explicitly a browser-only fallback, not a backend.

## Commands and verification

```bash
bun test
bun run typecheck
bun run build
git diff --check
```

Current V2B verification:

- `bun test` — **33 passing** tests (catalog plus analytics/CSV parsing).
- `bun run typecheck` — passes with `tsc --noEmit`.
- `bun run build` — production client and SSR build passes.
- `git diff --check` — no whitespace errors.
- Smoke verification after publishing covers `/`, `/strategies/stochextreme-adaptive`, `/publish`, and `/admin`; browser console is checked for runtime errors.

## Boundaries and next input

Historical results do not predict future performance. The UI does not make guarantees or recommendations.

The next required owner input is the actual per-trade and equity evidence listed above, conforming to `docs/REAL_DATA_IMPORT.md`. Until then, aggregate values may be presented as owner-supplied, but all series-dependent real analytics stay pending.
