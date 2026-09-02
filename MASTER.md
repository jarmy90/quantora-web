# Quantora — MASTER

Estado maestro del repositorio. Sin secretos.

## Estado actual

- **Producto**: plataforma activa con **cuatro estrategias publicadas** (no demo, no beta, no revisión).
- **Publicación**: cualquier estrategia en el catálogo está aprobada para publicación. Los estados editoriales internos (verificado / no verificado / en revisión / owner supplied / reproducción independiente) nunca se muestran al público.
- **Estado comercial**: pendiente por decisión; la presentación pública es "Commercial access opening soon · Join the waitlist". No hay precios, licencias, checkout ni descargas activos.
- **Separación por origen (invariante)**: Backtest ≠ Demo monitoring ≠ Resultados de cuenta real.
- **Pagos / descargas / Demo Monitoring**: desactivados.
- **Supabase**: sin escrituras desde la app pública.

## Estrategias publicadas

1. `first-triangle-adaptive`
2. `first-triangle-gold-adaptive`
3. `stochextreme-adaptive`
4. `tm-bandas-s3`

Fuente: `public-strategies/` → `public-strategies/catalog.json` (generado por `scripts/intake/`, sin campos editoriales en el bundle público).

## Gobernanza de ramas / PRs

| PR | Rama | Estado |
| -- | ---- | ------ |
| #18 | merge de reparación producción (Nitro SSR) | Fusionado (`d68b0f2`) |
| #19 | `feat/easy-start-navigation` | Abierto, CI verde, revisión pendiente |
| #20 | `feat/QNT-0020-public-product-truth` | Abierto, CI verde, revisión pendiente |

Reglas: no fusionar automáticamente; no tocar `product-plans`; no mezclar QNT-0016; no activar pagos/descargas; no escribir en Supabase; entregas como un único informe TXT (o ZIP `.zip.txt`).

## Validación QNT-0020

- Typecheck `tsc --noEmit`: OK.
- Suites: QNT-0011 (12), QNT-0012 (26), QNT-0013 (32), QNT-0013d (15), QNT-0014 (14), QNT-0015 (17), QNT-0020 (9), intake (90), validation (58). TODAS en verde.
- Build (`vite build`), private-files check y `git diff --check`: OK.
- Rutas verificadas en preview: `/`, `/strategies`, las 4 fichas, `/how-to-install`, `/login`, `/register`, `/account`.
- La preview de rama de Vercel está tras el muro de autenticación de Vercel; la verificación de contenido se realizó sobre el preview gestionado del sandbox con el mismo código.

## Historial de tickets

- **QNT-0020 · Public product truth and active catalog**: catálogo activo, cuatro publicadas, sin estados editoriales públicos, waitlist honesta, terminología "Real account results". Ver `agent-deliveries/freebuff/QNT-0020_INFORME_FINAL.txt`.