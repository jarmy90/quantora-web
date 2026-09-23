## 6. Licencias por cuenta MT5 (QNT-0044) — protege los .ex5

- `quantoraex5/sources/LicenseGuard.mqh` — integras este candado en cada `.mq5`
  (cambia `QNT_LICENSE_SECRET` por tu secreto) y compilas en MetaEditor.
- `scripts/ops/generate-license-key.ts` — genera la clave del cliente para su
  numero de cuenta. Ver `scripts/ops/LICENSE_KEYS.md`.
- El cliente recibe solo el `.ex5` + su clave. El `.mq5` nunca sale de aqui.

```powershell
$env:QNT_LICENSE_SECRET = "TU_SECRETO_DE_COMPILACION"
Set-Location C:\Users\profesor\quantora-web
bun run scripts/ops/generate-license-key.ts 12345678   # numero de cuenta del cliente
```

## Verificacion final

```powershell
Set-Location C:\Users\profesor\quantora-web
git status                                   # arbol limpio
git log --oneline -8
bun run check 2>$null; echo "check exit: $LASTEXITCODE"
```
