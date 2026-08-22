# FREEBUFF_WORKFLOW · QNT-WORKFLOW-LOCAL

Permanent workflow configuration for the `jarmy90/quantora-web` workspace.

This file is part of the public repository. It is descriptive documentation only
and does **not** alter the application's runtime behavior.

---

## 1. ARCHIVO DE WORKFLOW

Este archivo, `FREEBUFF_WORKFLOW.md`, conserva las reglas permanentes del flujo
de trabajo local en este workspace.

Cualquier encargo debe cumplir lo aquí definido. Las reglas son aditivos a
las normas globales del proyecto y nunca las sustituyen.

---

## 2. SEPARACIÓN DE REPOSITORIOS

`quantora-web` es un repositorio **PÚBLICO**.

**Puede contener:**

- frontend;
- catálogo;
- fichas;
- pipeline de intake;
- manifests públicos;
- métricas;
- curvas;
- documentación no sensible;
- metadatos comerciales seguros.

**Nunca puede contener:**

- MQ5;
- EX5;
- SET;
- ZIP comerciales;
- secretos;
- credenciales;
- enlaces directos al vault;
- rutas privadas;
- hashes de código fuente privado;
- archivos de entrega de EA.

El repositorio privado es:

`jarmy90/quantora-ea-vault`

**No abrir, leer, listar, modificar ni copiar archivos de ese repositorio
desde este workspace salvo encargo explícito y separado.**

---

## 3. FLUJO GIT OBLIGATORIO

Antes de cada tarea:

1. Ejecutar `git status`.
2. Verificar la ruta exacta del working tree.
3. Verificar el remoto `origin`.
4. Ejecutar `git fetch origin`.
5. Actualizar `main` mediante fast-forward only.
6. Confirmar working tree limpio.
7. Registrar SHA base.
8. Crear una rama nueva para el encargo, salvo que el usuario indique
   expresamente continuar un PR existente.

**Nunca trabajar directamente en `main`.**

Nombres de rama:

```
feat/QNT-XXXX-descripcion
```

Cuando exista un PR previo:

- usar su misma rama;
- actualizar el mismo PR;
- no crear otro PR sin autorización.

- No hacer merge automáticamente.
- No hacer deploy automáticamente.
- No ejecutar `go-live`.

---

## 4. GESTIÓN DE DEPENDENCIAS

**Package manager:** `bun`.

Si faltan dependencias:

```
bun install
```

**No crear:**

- `package-lock.json`;
- `yarn.lock`;
- `pnpm-lock.yaml`.

**Conservar** `bun.lock`.

No instalar dependencias nuevas salvo necesidad justificada.

---

## 5. VALIDACIÓN OBLIGATORIA

Después de cada cambio ejecutar, cuando correspondan:

```
bun run strategies:ingest
bun run strategies:validate
bun run strategies:build
bun run strategies:report
bun run strategies:intake
bun run build
```

Ejecutar también los scripts de tests existentes aunque `package.json` no tenga
un alias general de `test`.

Inspeccionar `scripts/` para identificar:

- tests de dominio;
- tests del intake;
- validaciones específicas de la estrategia modificada.

Ejecutar el typecheck mediante el comando apropiado del proyecto.

Registrar por separado:

- errores nuevos;
- errores preexistentes.

No declarar éxito completo si se introducen errores nuevos.

Ejecutar:

```
git diff --check
```

Confirmar working tree limpio después del commit.

---

## 6. PREVIEW LOCAL

En Desktop sí se permite iniciar el entorno local para verificar la web.

Usar los comandos definidos por el proyecto, preferiblemente:

```
bun run dev
```

**No ejecutar:**

```
bun run go-live
```

El preview local debe utilizarse para comprobar:

- catálogo;
- fichas;
- navegación;
- responsive;
- errores de consola;
- HTTP;
- visualización desktop;
- visualización móvil.

Detener el servidor al finalizar si ya no es necesario.

No publicar ni desplegar para obtener un preview.

---

## 7. CAPTURAS

Cuando una tarea modifique interfaz, generar:

- catálogo desktop;
- catálogo móvil;
- ficha afectada desktop;
- ficha afectada móvil.

Guardar las capturas dentro de:

```
agent-deliveries/freebuff/capturas-<encargo>/
```

**No reutilizar capturas antiguas como evidencia de una versión nueva.**

---

## 8. ENTREGA ÚNICA OBLIGATORIA

Cada encargo debe generar **un único paquete principal**:

```
agent-deliveries/freebuff/<ENCARGO>_Cambios.zip.txt
```

Debe ser un **ZIP real** aunque termine en `.zip.txt`.

Debe contener:

- archivos añadidos completos;
- archivos modificados completos;
- `GIT_DIFF.patch`;
- `CAMBIOS.txt`;
- `ARCHIVOS_MODIFICADOS.txt`;
- `COMANDOS_Y_RESULTADOS.txt`;
- `INVENTARIO_PAQUETE.txt`;
- tests relevantes;
- capturas cuando exista cambio visual.

`PACKAGE_INTEGRITY` puede entregarse junto al paquete para registrar su tamaño
y SHA-256 exactos.

**No entregar numerosos enlaces individuales.**

---

## 9. FORMATO FINAL SIMPLIFICADO

La respuesta final debe utilizar solamente los siguientes campos:

```
STATUS:
REPOSITORY:
BRANCH:
SHA BASE:
SHA FINAL:
PR:
PR STATUS:
MERGEABILITY:
TESTS:
BUILD:
TYPECHECK:
PREVIEW:
WORKING TREE:
PAQUETE PRINCIPAL:
TAMAÑO:
SHA-256:
ENLACE DE DESCARGA:
NO MERGE:
NO DEPLOY:
```

Mostrar únicamente:

1. Enlace del PR.
2. Enlace del paquete principal.
3. Enlace opcional de `PACKAGE_INTEGRITY`.

No enumerar enlaces separados a cada documento.

---

## 10. REGLAS DE DATOS

**No inventar:**

- costes;
- timestamps UTC;
- capital;
- unidades;
- drawdown porcentual;
- métricas monetarias;
- brokers;
- símbolos;
- resultados.

**Separar:**

- operaciones cerradas;
- posiciones abiertas;
- costes aplicados;
- costes no disponibles;
- equity intratrade;
- equity reconstruida al cierre.

**Mantener los estados internos fuera del bundle público.**

---

## 11. REGLAS VISUALES DE QUANTORA

En tarjetas públicas:

**Primera fila:**

1. Net result
2. Profit Factor
3. Quantora Score

**Segunda fila:**

4. Total trades
5. Frequency
6. Drawdown

Reglas:

- net result positivo en verde;
- PF neutro;
- score verde lima;
- drawdown al final;
- drawdown como magnitud positiva;
- coral suave o ámbar para riesgo normal;
- rojo intenso para error o riesgo crítico;
- no fabricar porcentaje;
- mantener unidades derivadas de datos.

---

## 12. SEGURIDAD

Antes de cada commit comprobar:

- ausencia de secretos;
- ausencia de tokens;
- ausencia de rutas personales;
- ausencia de MQ5, EX5 y SET;
- ausencia de archivos del vault privado;
- ausencia de `node_modules`;
- ausencia de builds innecesarios;
- ausencia de archivos temporales.

**No modificar la visibilidad del repositorio.**

---

## 13. OBJETIVO DEL ENCARGO

**Crear únicamente:**

- `FREEBUFF_WORKFLOW.md`

**No modificar lógica, catálogo, manifests ni frontend.**

**Crear rama:**

```
chore/QNT-local-workflow
```

**Abrir un PR nuevo.**

**Generar paquete:**

```
agent-deliveries/freebuff/QNT-WORKFLOW-LOCAL_Cambios.zip.txt
```

- No hacer merge.
- No hacer deploy.

Al finalizar, responder con el formato simplificado y un único enlace principal.

---

## 14. CI AUTOMÁTICO

`quantora-web` dispone de integración continua en GitHub Actions:

- **Workflow:** `.github/workflows/quantora-ci.yml` (`Quantora CI`).
- **Disparadores:** cada `pull_request` dirigido a `main`, cada `push` a
  `main` y ejecución manual (`workflow_dispatch`).

El CI valida automáticamente:

- instalación reproducible con `bun install --frozen-lockfile`;
- tests de dominio;
- tests de intake;
- `strategies:validate` y pipeline de estrategias;
- typecheck (`bun x tsc --noEmit`);
- build cliente y SSR;
- `git diff --check`;
- protección de archivos privados (sin MQ5, EX5, SET ni DLL versionados,
  sin `.env`/claves/tokens).

Reglas:

- **Un PR contra `main` no debe fusionarse si `Quantora CI` está en rojo.**
- El CI **no hace deploy**: solo valida.
- El merge sigue siendo manual.
- MQ5, EX5, SET y DLL están **prohibidos** en `quantora-web`.
