# Strategy datasets and evidence

Optional files referenced by a manifest's `evidence[]` list belong here (or next
to the manifest). The intake pipeline computes a SHA-256 hash for each file and
classifies it `public` or `private`.

- `public` evidence may be exposed by name + hash in the catalog.
- `private` evidence is represented by hash + kind only (never its name, path or
  contents).
- Forbidden extensions are never allowed in the public output: `.mq4`, `.mq5`,
  `.ex4`, `.ex5`, `.set`, `.env`, `.pem`, `.key`, `.crt`, `.p12`, `.pfx`.

> Privacy: files in this folder are gitignored except this README. Do not commit
> source code, credentials, broker exports, reports or any evidence that is not
> intended for the public bundle.
