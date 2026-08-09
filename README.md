# Quantora — Phase 1 product expansion

Ampliación de producto Fase 1 sobre la base existente (TanStack Start + React 19 + Vite + Tailwind 4, TypeScript strict, `src/i18n` en-US). **No se ha desplegado producción**; el preview público sigue en el puerto 3000 del workspace.

## Qué añade esta iteración

- **Modelo tipado extensible** (`src/domain/product.ts`): catálogo de estrategias con Power Score 1–10, 6 dimensiones ponderadas, contexto/riesgo/experiencia/frecuencia, métricas tipadas y provenance `real`/`mock`. Única fuente de verdad — los componentes no duplican métricas.
- **Datos exactos del propietario** (provenance `real`, etiquetados "Owner-provided data"):
  - First Triangle Adaptive: Power Score 7.2 · PF 1.2559 · 145 ops · +6,687.50 USD · +46.12 USD/op · DD 4,474.80 USD.
  - StochExtreme Adaptive: Power Score 6.1 · PF 1.1514 · 421 ops · +6,582 USD · DD 26.53% / 4,690 USD · 01/08/2025–07/08/2026 · 509,489,041 ticks.
  - Las 4 estrategias legacy siguen como fixtures MOCK claramente etiquetados.
- **Explicación obligatoria del Power Score** (`POWER_SCORE_EXPLANATION`) renderizada literalmente en home, catálogo, ficha y comparador; lenguaje no-promisorio en todo el producto.
- **Catálogo** (`/strategies`): hero + cards con Power Score, filtros contexto/riesgo/experiencia/frecuencia + orden, skeletons, empty state, CTA explorar y CTA "Publish your strategy", compare tray.
- **Fichas completas** (`/strategies/$id`): score, métricas, cómo funciona, contexto adecuado/no adecuado, "¿Te encaja?", desglose de 6 dimensiones, datos detrás del score, metodología, limitaciones y evidencia. Para estrategias reales **no se inventa curva**: se muestra "pendiente de entrega".
- **Comparador** (`/compare`) hasta 3 estrategias con tabla de métricas.
- **Selector guiado** (`/matcher`): 4 preguntas (movimiento, riesgo, experiencia, frecuencia) con resultados explicados y aviso explícito de que no es recomendación financiera.
- **Wizard "Publica tu estrategia"** (`/publish`): 5 pasos, autoguardado local, reanudación (`?draft=<id>`), drag-drop (solo metadatos), validación amigable, progreso, consentimiento, estado privado, **sin publicación automática**; "Request review" solo cambia un flag local.
- **Área creador** (`/creator`): lista de borradores privados con reanudar/eliminar.
- **Base de admin** (`/admin`): protegida por rol (`RequireRole`), NO enlazada públicamente, con switcher de rol demo claramente marcado; cola de revisión de solo lectura.
- **Contratos sustituibles**: roles `visitor/user/creator/admin` (`src/auth/session.tsx`), favoritos, borradores y comparador (`src/state/*`), analytics con consentimiento y sin datos sensibles (`src/analytics/analytics.ts`).
- **SEO/OpenGraph**: `Seo` por ruta (title/description/OG) + `head` raíz; páginas de estrategia con título dinámico.
- **Dashboard** (`/dashboard`): panel de favoritos añadido (localStorage) sobre la sección existente de licencias/descargas/actividad.

## Arquitectura

- `src/domain/` — modelo de producto y lógica pura (product, matcher, compare, publish). Sin React.
- `src/state/` — client state (favorites, drafts, compare) sobre localStorage con wrapper SSR-safe; **fallback explícito, nunca un backend fingido**.
- `src/auth/` — contrato de sesión/roles sustituible; sin autenticación real (fuera de alcance).
- `src/analytics/` — capa de analytics consentida y anónima; sin recopilador externo en Fase 1.
- `src/components/` — primitivas UI + StrategyCard + CompareTray + Seo.
- `src/routes/` — rutas TanStack (todas las nuevas rutas listadas arriba).

## Verificación ejecutada

- `bun run build` (producción) — OK (client + SSR).
- `bun run typecheck` (`tsc --noEmit`) — limpio; `serve.ts` (script runtime Bun) queda excluido del chequeo por tipado de Bun (preexistente).
- `bun test` — 7 tests de dominio (métricas exactas del propietario, consistencia de dimensiones, explicación del Power Score, límite del comparador, matcher, validación del wizard).
- Smoke: rutas `/`, `/strategies`, `/strategies/first-triangle-adaptive`, `/strategies/stochextreme-adaptive`, `/compare`, `/matcher`, `/publish`, `/creator`, `/admin`, `/dashboard` responden HTTP 200 en el preview.

## Decisiones

- **UI en inglés**: coherente con el producto existente (`src/i18n` solo en-US); la localización ES es un siguiente paso, no un cambio de esta iteración.
- **El filtro de activos legacy** se sustituyó por los 4 filtros del encargo (contexto/riesgo/experiencia/frecuencia); el activo sigue visible como badge en las cards.
- **Sin curvas inventadas** para estrategias reales (solo métricas del propietario).
- **Sin panel de compra/licencia** en la ficha (el antiguo panel simulado se eliminó; no hay pagos en Fase 1).
- **Dimensiones del score**: desglose indicativo del modelo Quantora calibrado a la suma del total del propietario, etiquetado como tal.
- **Persistencia local** (localStorage) marcada explícitamente como fallback demo en cada superficie.

## Próximos pasos (bloqueantes reales)

1. El propietario debe entregar **curvas de equity y trade logs** de las 2 estrategias para activarlas vía el importador Phase 2A (formato en `docs/REAL_DATA_IMPORT.md`).
2. Autenticación real y backend para drafts/favoritos (los contratos ya están definidos; solo falta el provider).
3. Revisión legal de las páginas legales placeholder (preexistente).
