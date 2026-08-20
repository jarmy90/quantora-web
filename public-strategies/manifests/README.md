# Accepted strategy manifests

This directory holds the manifests that feed the public catalog build:

```bash
bun run strategies:build
```

- One `<id>.manifest.json` file per strategy.
- Manifests contain public metadata plus the structured domain dataset; they never
  contain raw private evidence (that is referenced by hash only).
- No manifest may set `validationStatus: "quantora_validated"` without an
  explicit editorial decision from Javier and M365 Copilot.
