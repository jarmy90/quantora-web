# First Triangle Adaptive — authorized source files

Authorized source for **QNT-0003** (First Triangle Adaptive).

- Source branch: `data/quantora-real-backtests`
- Source SHA: `2275c5d0e76d955c26df482be928ddd03bb9fc00`
- Source archive: `Descargar First Triangle para Quantora.zip`

Extracted files (five evidence files, committed here so the importer is
reproducible):

| File | Kind | Classification | Purpose |
| ---- | ---- | -------------- | ------- |
| `first_triangle_web_manifest.json` | source | private | Source run metadata, selection + metrics |
| `first_triangle_web_summary.csv` | summary | private | Closed-run summary metrics |
| `first_triangle_web_trades.csv` | trades | private | Closed-trade log |
| `first_triangle_web_equity.csv` | equity | public | Closed-trade cumulative equity curve |
| `first_triangle_web_signals.csv` | signals | private | Signal/entry log |

Privacy rule: `trades`, `signals`, `summary` and the source manifest are
**private** evidence. The intake pipeline exposes them by SHA-256 hash + kind
only — never by filename, path, or contents — and the frontend never imports
them. Only `equity` is public (its parsed values are the public equity chart).
