# Quantora · Auditoría de ramas (QNT-0040 · Fase 0 "higiene")

**Objetivo:** decidir con datos qué hacer con las ramas sin mergear antes de
abrir trabajo comercial (precios, cobro, SEO, vendedores).

**Commit base auditado:** `fc4f344` (`main` de quantora-web, tras el merge del
PR #29 `chore/QNT-hide-backtest-broker`).
**Método (reproducible, sin juicios de valor):**

```bash
git branch -r --no-merged origin/main          # ramas sin integrar
git rev-list --count origin/main..origin/<b>   # commits propios de la rama
git merge-tree --write-tree origin/main origin/<b>   # conflictos reales
git diff --name-only origin/main...origin/<b>  # ficheros afectados
```

## 1. Resumen

- Ramas remotas totales: 30 · sin mergear en `main`: **14**.
- De esas 14, **9 no aportan nada nuevo** (su contenido ya está en `main` por
  otra vía o es una versión anterior) y **3 sí aportan valor**.
- Ninguna de las 14 es requisito para el trabajo comercial de Fase 1/2.

## 2. Estado real del catálogo (dato que corrije documentación previa)

`public-strategies/catalog.json` en `main` publica **3 estrategias**, todas
`coming_soon` y `commercialDownloadEnabled=false`:

| id | productId | productStatus |
| -- | --------- | ------------- |
| `first-triangle-adaptive` | `first-triangle-ustec-m30` | `coming_soon` |
| `first-triangle-gold-adaptive` | `first-triangle-gold-m15` | `coming_soon` |
| `stochextreme-adaptive` | `stochextreme-ustec` | `coming_soon` |

`tm-bandas-s3` **ya no está publicado** (su manifiesto vive en
`strategy-intake/archive/`). `MASTER.md` decía "cuatro estrategias publicadas":
queda corregido en este mismo PR.

## 3. Ramas sin mergear — decisión recomendada

### 3.1 Cerrar (contenido ya integrado o superado) — 6

| Rama | Commits | Conf. | Motivo | Decisión |
| ---- | ------- | ---- | ------ | -------- |
| `fix/QNT-0016-vercel-404` | 1 | 1 | `main` ya tiene la versión moderna de `vite.config.ts` (preset Nitro por `VERCEL=1`, sin BOM); la rama trae la **anterior** | Cerrar |
| `chore/QNT-0021-remove-tm-bandas-public` | 1 | 1 | En `main` `tm-bandas-s3` ya no está en el catálogo público (3 estrategias, manifiesto archivado) | Cerrar |
| `docs/QNT-0025-stripe-payments-plan` | 1 | 0 | El plan vigente es `docs/QNT-0025-stripe-test.md` (ya en `main`, e implementado en código) | Cerrar |
| `docs/add-freebuff-workflow` | 2 | 0 | Propone una reescritura **más corta** de `FREEBUFF_WORKFLOW.md`; `main` tiene la versión vigente más completa | Cerrar (o reescribir aparte si se quiere acortar) |
| `delivery/QNT-0003-review` | 1 | 1 | El paquete ya está en `main` (`agent-deliveries/freebuff/QNT-0003_Cambios.zip.txt`) | Cerrar |
| `benchmark/freebuff-qnt0002r2-review` | 1 | 0 | Entrega histórica de auditoría de un agente; no aporta al producto | Cerrar |

### 3.2 Cerrar sin mergear nunca (contienen binarios) — 4 ⚠️

| Rama | Contenido | Por qué **no** se mergea |
| ---- | --------- | ------------------------ |
| `eafinal` | `public-strategies/Descargar Quantora TM Bandas S3 … .zip` | Un **ZIP con EA dentro de `public-strategies/`**, carpeta que el servidor sirve al público. Rompe el invariante "los `.ex5` nunca se exponen". Además el CI (`check-private-files.sh`) lo bloqueará si se descomprime en el repo |
| `data/quantora-real-backtests` | `OROM15.zip`, `STOCHEXTREME.rar`, `Descargar First Triangle … .zip`, CSV | Datos de evidencia, no código. Deben entrar por el pipeline a `strategy-intake/` (gitignored), nunca como binarios versionados |
| `delivery/QNT-0002F-review` | 2 × `.zip.txt` de entrega | Paquetes de trabajo cerrados |
| `feat/fase1-catalog-comparator-publish` | 32 ficheros, **10 conflictos**, del 2026-08-09 (`src/analytics/`, `src/auth/session.tsx`, comparador) | Anterior al diseño actual (QNT-0011/0012/0013). El comparador es una idea válida, pero se reimplementa en Fase 3 (SEO) sobre la arquitectura vigente |

### 3.3 Descartar y rehacer (diseño superado) — 1

| Rama | Commits | Conf. | Motivo |
| ---- | ------- | ----- | ------ |
| `feat/QNT-0015-product-plans-conversion` | 1 | 8 | Crea `src/routes/products.$productId.tsx` con planes, pero **anterior** a `prices.ts` (QNT-0025) y al contrato planes/manifiesto. Fase 1 lo sustituye con un enfoque canónico |

### 3.4 Integrar (aportan valor real) — 3

| Rama | Commits | Conf. | Qué aporta | Decisión |
| ---- | ------- | ----- | ---------- | -------- |
| `docs/QNT-0030-seller-intake-plan` | 1 | 0 | `docs/QNT-0030-seller-intake.md`: plan completo del marketplace ("Drop your EA", estados, submit≠publish, cuarentena, Stripe Connect) | **Mergear** (solo documentación, 0 conflictos) |
| `feat/QNT-pdf-install-guide` | 1 | 0 | PDF de instalación MT5 en `public/` + CTA en `/how-to-install` y fichas + i18n | **Mergear** (0 conflictos) |
| `feat/easy-start-navigation` | 1 | 2 | Enlace "Easy Start" en `Nav`/`Footer` | **Mergear** (2 conflictos triviales, revisar i18n) |

## 4. Reglas de gobernanza (recordatorio)

1. **No se fusiona automáticamente**: cada integración va por PR revisado.
2. **Nunca** se mergea una rama que introduzca `.ex5/.mq5/.set/.dll` ni ZIP con
   EAs en el árbol (el CI lo bloquea; ver `.github/scripts/check-private-files.sh`).
3. Las ramas se borran solo después del merge (como con
   `chore/add-quantora-web-submodule`).

## 5. Próximos pasos

1. Confirmar las 3 integraciones de 3.4 → abrir un PR por rama.
2. Borrar el resto de ramas (remotas y locales) tras confirmar la lista.
3. Continuar con Fase 1 (precios 300 € / 10 €/mes visibles) y Fase 2 (cobro).
