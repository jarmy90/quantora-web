# Quantora — MASTER

Estado maestro del repositorio. Sin secretos.

## Estado actual

- **Producto**: plataforma activa con **cuatro estrategias publicadas** (no demo, no beta, no revisión).
- **Publicación**: cualquier estrategia en el catálogo está aprobada para publicación. Los estados editoriales internos (verificado / no verificado / en revisión / owner supplied / reproducción independiente) nunca se muestran al público.
- **Estado comercial**: pendiente por decisión; la presentación pública es "Early access · Get access updates" dirigida a crear cuenta (la waitlist no persiste datos y nunca afirma haberlos guardado). No hay precios, licencias, checkout ni descargas activos.
- **Separación por origen (invariante)**: Backtest ≠ Demo monitoring ≠ Resultados de cuenta real.
- **Costes en tarjetas**: nunca se muestran como badge; si `costsApplied=false` se renderiza la nota discreta "Backtest results exclude commission, spread, slippage and swap." antes del CTA. La ficha explica el tratamiento en el bloque "Trading costs" con formulaciones fieles a los datos.
- **Metodología (única nota)**: "Trading costs are shown exactly as provided by each backtest…" en la sección How it works de las fichas.
- **Footer global**: cierre profesional "Historical results do not guarantee future performance. Not financial advice."; sin "Demo experience" ni aviso de placeholder legal.
- **Header global**: sin banner "MOCK ENVIRONMENT" en la cara pública.
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
- Suites: QNT-0011 (12), QNT-0012 (26), QNT-0013 (32), QNT-0013d (15), QNT-0014 (14), QNT-0015 (17), QNT-0020 (17), intake (90), validation (58). TODAS en verde.
- Build (`vite build`), private-files check y `git diff --check`: OK.
- Rutas verificadas en preview: `/`, `/strategies`, las 4 fichas, `/how-to-install`, `/login`, `/register`, `/account`.
- La preview de rama de Vercel está tras el muro de autenticación de Vercel; la verificación de contenido se realizó sobre el preview gestionado del sandbox con el mismo código.

## Historial de tickets

- **QNT-0020 · Public product truth and active catalog**: catálogo activo, cuatro publicadas, sin estados editoriales públicos, waitlist honesta, terminología "Real account results". Ver `agent-deliveries/freebuff/QNT-0020_INFORME_FINAL.txt`.
- **QNT-0020 · Corrección final de product truth**: costes sin badge (nota discreta en tarjetas + bloque "Trading costs" en fichas), navegación sin duplicados (un enlace Strategies por menú), early access honesto ("Get access updates" → crear cuenta, sin guardar datos), footer profesional sin demo/placeholder, sin banner MOCK en header, copy de home orientado a Expert Advisors/MT5. Sin cambios de datos, métricas, manifests, Supabase ni flags. Queda pendiente: revisión visual real de Javier/M365 Copilot (no disponible navegador en el sandbox) y revisión humana de los documentos legales antes del lanzamiento comercial.