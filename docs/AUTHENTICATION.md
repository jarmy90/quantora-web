# Quantora · Authentication (QNT-0013)

Status:

- **Auth foundation: implemented** (contracts, service, routes, SSR sessions)
- **Live Supabase project: configured and live-verified** (migrations `0001`
  + `0002` applied; registration, confirmation, login, logout and password
  recovery verified with one owner-controlled test account; zero orders,
  payments, licenses, entitlements and downloads)
- **Payments: not implemented**
- **Licensing: not implemented**
- **Downloads: not implemented**

## Architecture

- **Provider:** Supabase Auth, email + password only (no OAuth/MFA/phone yet).
- **Sessions:** renewable SSR session managed by `@supabase/ssr`
  (`createServerClient`) through a server-side cookie adapter
  (`src/domain/auth/ssr-cookies.ts`). Access and refresh tokens live in
  separate HttpOnly cookies (`quantora-auth-token`, `quantora-refresh-token`);
  the refresh token is never discarded, so sessions can actually renew with
  Supabase's own expiry and rotation. The browser never reads tokens from
  JavaScript and nothing is stored in browser storage.
- **SSR:** sessions are verified server-side on every guarded request via
  `supabase.auth.getUser(token)` — the client is never trusted on its own.
- **Separation:** the application depends on the `AuthService` contract in
  `src/domain/auth/contracts.ts`, not on the Supabase SDK directly. The only
  production implementation is `src/domain/auth/service.ts`
  (`SupabaseAuthService`); `src/domain/auth/fake.ts` is TEST-ONLY.

### Files

| Path | Purpose |
| --- | --- |
| `src/domain/auth/contracts.ts` | `AuthUser`, `AuthSession`, `AuthResult`, `AuthService`, `isSafeReturnTo` |
| `src/domain/auth/validation.ts` | pure email / password / display-name validators |
| `src/domain/auth/service.ts` | Supabase implementation + cookie management |
| `src/domain/auth/server.ts` | TanStack server functions (signUp/signIn/signOut/reset/update/status) |
| `src/lib/supabase/env.ts` | env contract: `configured` / `not_configured` / `invalid_configuration` |
| `src/routes/login.tsx` etc. | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/account` |
| `db/migrations/0002_customers_auth_user.sql` | `customers.auth_user_id uuid UNIQUE REFERENCES auth.users(id)` + RLS prep |

## Environment variables

```
VITE_SUPABASE_URL=                  # public, browser-safe
VITE_SUPABASE_PUBLISHABLE_KEY=      # public, browser-safe
SUPABASE_SERVICE_ROLE_KEY=          # server-only, NEVER VITE_, not used yet
```

- `VITE_` variables are the only ones the browser sees.
- `SUPABASE_SERVICE_ROLE_KEY` is reserved; this phase never uses it.
- Missing public variables → the app shows a clear **AUTH_NOT_CONFIGURED**
  screen instead of forms; the rest of the site keeps working.

## Setting up the live Supabase project (manual, applied)

1. Create a Supabase project (URL + anon key go into `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_PUBLISHABLE_KEY`).
2. Enable **Email** provider under Authentication → Providers.
3. Under **URL Configuration**:
   - Site URL: `http://localhost:3000` (local) or the deployed origin.
   - Redirect URLs: add `http://localhost:3000/auth/callback` (local) and the
     deployed callback.
4. Email confirmation is on by default → sign-up mails include a confirmation
   link (`/auth/callback?type=signup&code=...`).
5. Password recovery: the reset email redirects to
   `/auth/callback?type=recovery&code=...`, which exchanges the code and
   sends the user to `/reset-password`.
6. Apply `db/migrations/0002_customers_auth_user.sql` (with
   `0001_commercial_foundation.sql`) — requires authorization; nothing is
   applied automatically.

## Auth ↔ customer relationship

Supabase identities live in `auth.users` (uuid). The commercial
`customers` table keeps its own `customer_id` and now references the auth
identity via `auth_user_id uuid UNIQUE REFERENCES auth.users(id)`. The two
are deliberately separate identifiers; `customer_id` stays the commercial
identifier used by orders/licenses. `email`/`display_name` remain nullable
until the identity mechanism is final.

## Security

- Cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`,
  with expiry driven by Supabase's session lifecycle (no fixed 7-day max-age
  claimed). On sign-out every auth cookie is expired and removed.
- Open redirects: `returnTo` is validated by `isSafeReturnTo()` (internal
  paths only) before any redirect.
- `paid` orders, licenses, downloads: still impossible; all commercial
  feature flags default to false.
- No CAPTCHA yet — revisit when spam becomes a real signal.
- Service role key: never imported by any module in this phase.

## Tests

```bash
bun run scripts/test-qnt-0013.ts
```

Runs 20 tests against the TEST-ONLY fake — no real Supabase calls, no real
personal data. It covers validators, service flows, reset-link privacy,
`returnTo` safety, env states, migration 0002, and the no-commercial-
activation guarantees.

## Not implemented (future phases)

- Payments (QNT-0017), licensing and protected downloads (QNT-0018).
- OAuth, MFA, phone auth, admin/creator portals.
