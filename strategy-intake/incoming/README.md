# Incoming strategies (drop zone)

Drop new strategy manifests here to run them through the intake pipeline:

```bash
bun run strategies:intake
```

- A manifest is a single `<id>.manifest.json` file (see `strategy-intake/templates/manifest.template.json`).
- Evidence files referenced by the manifest live alongside it (or under `public-strategies/datasets/`).
- Anything placed here is a *staging* area, not the public catalog. Accepted manifests are moved to `public-strategies/manifests/` for the catalog build.

> Privacy: files in this folder are gitignored except this README. Never commit
> `.mq4`, `.mq5`, `.ex4`, `.ex5`, `.set`, `.env`, credentials, secrets, local
> paths or other private evidence here.
