# SUPABASE LIVE SETUP (QNT-0013D)

Guía breve para preparar el proyecto Supabase real de Quantora. No activa
planes, precios, pedidos, pagos, licencias ni descargas.

## Qué ejecutar y en qué orden

1. Abrir Supabase Dashboard → SQL Editor → New query.
2. Pegar **todo** el contenido de:

   `db/migrations/live/001_live_setup.sql`

3. Ejecutar (Run). Es idempotente: puede re-ejecutarse sin romper nada.

El archivo aplica, en orden:

| Orden | Paso | Origen |
|-------|------|--------|
| 1 | Fundación comercial (products, plans, customers, orders, payments, licenses, entitlements + seed de 4 productos `coming_soon`) | migración 0001 (QNT-0012) |
| 2 | Relación `customers.auth_user_id → auth.users.id` (uuid UNIQUE + índice) | migración 0002 (QNT-0013) |
| 3 | RLS cerrada por defecto en las 7 tablas comerciales; `customers` con política SELECT de la propia fila | 0002 (endurecido QNT-0013E) |
| 4 | Privilegios: `REVOKE ALL` de anon/authenticated sobre products, plans, orders, payments, licenses, entitlements; `customers` solo SELECT de columnas mínimas | nuevo (QNT-0013E) |
| 5 | Trigger de alta de cliente (estándar, no opcional): crea la fila `customers` al registrarse | nuevo (QNT-0013E) |

## Resultado esperado

- Banner de éxito verde del SQL Editor.
- Tras el primer registro y confirmación de email, existe una fila en
  `customers` con `auth_user_id` = el UUID del usuario de auth, `role =
  'customer'`, `status = 'pending'`, `email` = el email del usuario,
  `display_name` = NULL.

## Cómo verificar

```sql
-- Tablas y seed
SELECT product_id, status, commercial_download_enabled
FROM products ORDER BY product_id;

-- Relación auth -> customer (después del primer registro de prueba)
SELECT c.customer_id, c.auth_user_id, c.email, c.status
FROM customers c
WHERE c.auth_user_id IS NOT NULL;

-- Constraints de billing
SELECT conname FROM pg_constraint WHERE conname = 'plans_billing_combination';

-- RLS activa (deben salir las 7 filas con relrowsecurity = t)
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('products','plans','customers','orders','payments','licenses','entitlements')
ORDER BY relname;

-- Políticas existentes (solo debe haber customers_read_own)
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Grants de tablas comerciales (debe quedar solo customers -> authenticated, SELECT)
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('products','plans','customers','orders','payments','licenses','entitlements')
ORDER BY table_name, grantee;
```

Comprobaciones de seguridad tras aplicar:

- Las 7 tablas comerciales tienen RLS activa (`relrowsecurity = t`).
- La única política es `customers_read_own` con `auth.uid() = auth_user_id`;
  no existe `USING (true)` en ninguna parte.
- `anon` y `authenticated` no tienen ningún privilegio sobre products, plans,
  orders, payments, licenses ni entitlements (revocados).
- `customers`: `anon` sin privilegios; `authenticated` solo `SELECT` (las
  columnas mínimas) y filtrado por la política a la propia fila. Sin UPDATE
  en esta fase.
- No hay filas en `orders`, `payments`, `licenses` ni `entitlements`.
- `plans` sigue vacía y sin precios.

Notas de arquitectura:

- `products` continúa consumiéndose desde el catálogo versionado del
  repositorio (`public-strategies/catalog.json`), no desde Postgres.
- Las tablas comerciales están cerradas por defecto; el acceso server-side o
  de administración futuro se diseñará en fases posteriores (QNT-0015+).
- El service role no se utiliza en la aplicación actual y no está en
  `.env.local`.

## Rollback

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP POLICY IF EXISTS customers_read_own ON customers;
ALTER TABLE products      DISABLE ROW LEVEL SECURITY;
ALTER TABLE plans         DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers     DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders        DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments      DISABLE ROW LEVEL SECURITY;
ALTER TABLE licenses      DISABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements  DISABLE ROW LEVEL SECURITY;
-- Re-concede los grants por defecto de Supabase si quieres volver al estado
-- inicial (o vuelve a ejecutar el setup desde cero).
-- ALTER TABLE customers DROP COLUMN IF EXISTS auth_user_id;
-- (las tablas base pueden dejarse: son inofensivas y preparatorias)
```

## Qué NO está activado

- Planes, precios, pedidos, pagos, licencias, descargas y archivos EA.
- Exposición pública de `products`, `plans`, `orders`, `payments`,
  `licenses` o `entitlements` vía la API de Supabase. Si el dashboard de
  Supabase expone tablas por defecto, no publicar ninguna de esas tablas.
- `customers`: solo el propio usuario autenticado puede LEER su fila
  (SELECT); la edición de perfil (UPDATE con restricciones de columna) se
  habilitará junto a la pantalla de perfil.
- Monitorización demo, portal de creadores, roles avanzados, OAuth, MFA.

## Variables de entorno (nunca en Git)

`.env.local` en la raíz del repositorio, con **solo** estas dos:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` son públicas por
  diseño (el cliente las necesita). Sin valores reales en Git.
- `SUPABASE_SERVICE_ROLE_KEY` NO se usa en esta fase y no debe estar en
  `.env.local`.
- `.env.local` está ignorado por Git (`.gitignore`) y nunca se versiona.

## Prueba manual de autenticación (guía para el propietario)

Usa un email de prueba que tú controles. No lo incluyas en Git, capturas ni
documentos de entrega. Pasos:

1. Arranca la web local con `bun run dev` (con `.env.local` presente).
2. Abre `http://localhost:3000/register`.
3. Confirma que el estado `AUTH_NOT_CONFIGURED` ya no aparece.
4. Regístrate con email + contraseña de prueba (mín. 8 caracteres).
5. Abre el correo de confirmación que enviará Supabase y pulsa el enlace
   (llega a `/auth/callback?type=signup`).
6. Inicia sesión en `/login`.
7. Entra en `/account`: debe mostrar tu email, "Tus estrategias", "Licencias"
   y "Facturación" en estado vacío honesto, y el enlace para cerrar sesión.
8. Comprueba en Supabase SQL Editor que tu fila en `customers` existe con
   `auth_user_id` relleno (ver "Cómo verificar").
9. Cierra sesión.
10. Solicita recuperación en `/forgot-password` (no filtra si el email existe).
11. Abre el email de recuperación (callback `type=recovery` → `/reset-password`).
12. Establece una contraseña nueva y vuelve a iniciar sesión.

Estado objetivo tras la prueba:

- `customers` tiene 1 fila (el usuario de prueba) con `auth_user_id` único.
- Cero pedidos, pagos, licencias o descargas.
- Los 4 productos siguen `coming_soon` con `commercial_download_enabled =
  false`.
