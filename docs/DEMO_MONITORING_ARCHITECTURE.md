# Quantora · Demo Monitoring Architecture (QNT-0015)

## Objetivo del piloto

Probar de forma honesta y visual el seguimiento de **cuentas demo** por
estrategia, manteniendo siempre una separación inequívoca entre:

1. **Backtest** — evidencia histórica ya disponible en el catálogo.
2. **Demo monitoring** — seguimiento de una cuenta de demostración.
3. **Verified live** — resultados reales verificados. **No implementado.**

El piloto es un módulo etiquetado **DEMO MONITORING** que hoy muestra el
estado honesto `not_connected` (no existe ninguna conexión real con
MetaTrader 5, ningún balance, ni datos suministrados). No inventa saldos,
operaciones, rentabilidades ni estados de conexión.

## Contrato de datos (`src/domain/demoMonitoring/contracts.ts`)

`DemoMonitoringSnapshot` (resuelto siempre **server-side**):

- `strategyId` — referencia estable a la estrategia pública.
- `productId` (opcional) — referencia pública del producto, segura.
- `sourceType: 'demo'` — explícito y fijo.
- `declaredBoundary: 'backtest' | 'demo' | 'verified_live'` — declarado por
  la fuente; el módulo solo produce `'demo'`. `verified_live` nunca se
  emite (no implementado).
- `connectionStatus` — una de: `not_connected`, `connecting`, `live_demo`,
  `stale`, `offline`.
- `freshness` — `'unknown' | 'live' | 'stale'`, derivado de timestamps.
- `lastUpdatedAt`, `monitoringStartedAt` — ISO, solo si existen.
- `brokerLabel`, `accountLabel` — opcionales, **no sensibles**. Un label de
  cuenta nunca es un número de cuenta completo ni un investor password.
- `timeframe` — periodo de observación si se suministra.
- `metrics` (`DemoMonitoringMetrics`) — **solo** cuando existan datos demo
  reales suministrados: `balanceMinor`, `equityMinor`, `openTrades`,
  `drawdownPct`, `currency`, `reportedAt` (unidades monetarias en minor
  units, convención del repositorio).
- `unavailableReason` — mensaje de indisponibilidad siempre verdadero.

**Campos prohibidos** (nunca en el contrato, la UI ni los tests):
credenciales de MetaTrader, números completos de cuenta, tokens, secretos,
investor passwords, claves de broker, saldos inventados o rentabilidades
simuladas presentadas como reales.

## Máquina de estados (`src/domain/demoMonitoring/stateMachine.ts`)

Transiciones explícitas y deterministas (`canTransition`); el grafo se
documenta en el archivo. Estados:

- `not_connected` — no existe conexión configurada.
- `connecting` — conexión en proceso; **no** se afirma feed activo.
- `live_demo` — datos demo recientes disponibles.
- `stale` — hubo datos demo, pero superan la ventana de frescura.
- `offline` — la conexión configurada no está operativa.

`resolveConnectionStatus(input)` es el único resolutor: la UI recibe el
resultado y **nunca** decide por sí sola un estado de confianza.
`deriveDemoFreshness(lastUpdatedAt, now)` aplica la ventana documentada
(`DEMO_STALE_AFTER_MS` = 15 minutos por defecto).

## Separación de evidencias (ficha de estrategia)

- **BACKTEST**: sección histórica existente (métricas, equity, costes,
  limitaciones), sin cambios.
- **DEMO MONITORING**: sección nueva etiquetada **DEMO MONITORING** con su
  propio estado y frescura. Nunca mezcla métricas con el backtest (el
  componente solo recibe `strategyId`, nunca métricas).
- **VERIFIED LIVE**: no implementado ni mostrado como disponible; la leyenda
  de la ficha lo declara: *Backtest ≠ Demo monitoring ≠ Verified live
  result*.

## Política de frescura

- Sin datos suministrados → `freshness: 'unknown'` y `not_connected`.
- `lastUpdatedAt` dentro de la ventana (15 min por defecto) → `live_demo`.
- `lastUpdatedAt` fuera de la ventana → `stale`.
- Timestamp inválido → `unknown` (nunca se asume nada).

## Privacidad y campos prohibidos

Ver "Campos prohibidos" y el test `no credential/secret fields` de
`scripts/test-qnt-0015.ts`. No se almacena, transmite ni muestra nada
sensible; no hay capturas con datos personales.

## Feature flag

- `DEMO_MONITORING_ENABLED` (en `src/config.ts`) por defecto **false**.
- Mientras esté apagado, el server function devuelve `not_connected` con
  razón honesta. No activa checkout, pagos, descargas ni licencias.

## Ausencia actual de conexión real

No existe conexión real con MetaTrader 5, ni almacenamiento de credenciales,
ni feed de datos. La fuente piloto (`src/domain/demoMonitoring/source.ts`)
tiene un registro **vacío** — `not_connected` hasta que se suministren datos
demo reales. Nada sintetiza balances ni operaciones.

## Limitaciones

- Sin conexión MT5 real; sin captura de datos automática.
- Sin métricas demo hasta que existan datos suministrados.
- Sin visualizaciones históricas del módulo demo.
- Sin capturas visuales reales en esta entrega (entorno sin navegador).

## Cómo sustituir la fuente piloto por infraestructura server-side futura

1. Sustituir el resolver en `resolvePilotSnapshot` (registro/dataset interno
   → API server-side segura).
2. Mantener el contrato `DemoMonitoringSnapshot` y el server function
   `getDemoMonitoringSnapshot` (los consumidores no cambian).
3. Aplicar la máquina de estados `resolveConnectionStatus` en el servidor
   para derivar `connectionStatus`/`freshness` de la fuente real.
4. Subir el flag solo cuando el feed esté operativo y etiquetado como demo.
5. Nunca cruzar datos demo con el backtest ni con resultados live
   verificados.