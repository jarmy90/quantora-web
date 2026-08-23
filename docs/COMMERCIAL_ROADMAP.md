# Quantora · Commercial Roadmap (QNT-0012)

Goal: a professional, transparent, conversion-oriented platform that a
beginner or intermediate trader understands in ~10 seconds, with a simple
commercial flow and a clear separation between **historical backtest**,
**demo monitoring** and **verified live results**. Each phase below builds on
the previous one; nothing is merged or deployed automatically.

---

## QNT-0012 · Foundation (this phase)

- **Prerequisites:** QNT-0011 (real strategies, product states) merged.
- **Data involved:** none persisted; contracts, safe catalog, env contract,
  preparatory migration (not applied). Identity contract: `id` (internal
  uuid) vs `product_id` (stable text, UNIQUE) vs `strategy_id`; internal FKs
  use `product_ref`. `customer.email`/`display_name` are nullable until
  QNT-0013 decides identity. Billing rule: `rental` →
  monthly/quarterly/annual; `purchase` → one_time (validated in TS,
  `canSelectPlan` and SQL CHECK).
- **Security boundary:** feature flags default false; no write endpoints;
  secrets never leave the server.
- **Definition of done:** domain contracts, state rules, safe catalog,
  `.env.example`, `src/config.ts`, migration SQL, repository interfaces,
  architecture + roadmap docs, automated tests, CI green, no capability
  enabled.
- **Remains disabled:** everything commercial.

## QNT-0013 · Authentication and session

**Status: implemented (code) — live project configuration pending.**

- **Prerequisites:** QNT-0012 contracts; `.env.example`; customers table.
- **Data involved:** customers, session state (Supabase Auth, HttpOnly cookie).
- **Security boundary:** Supabase Auth (email + password), server-side session
  verification via `getUser(token)`, HttpOnly/SameSite/Lax cookies, safe
  `returnTo` (internal paths only), service-role key never used.
- **Definition of done (code):** registration, login, logout, password reset
  request + new-password flow, email-verification callback, protected
  `/account`, auth↔customer relation migration (`0002`), `AUTH_NOT_CONFIGURED`
  state, tests + CI step. See `docs/AUTHENTICATION.md`.
- **Pending:** owner creates the Supabase project, sets `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_PUBLISHABLE_KEY`, configures redirect URLs, applies
  migrations 0001+0002 with authorization.
- **Remains disabled:** purchases, payments, downloads, demo monitoring.

## QNT-0014 · Demo monitoring pilot

- **Prerequisites:** server functions infrastructure; safe product linkage.
- **Data involved:** demo-account monitoring records per strategy.
- **Security boundary:** demo data is separate from backtest and from
  verified live results; clearly labelled; no invented balances.
- **Definition of done:** a pilot module (labelled DEMO MONITORING) that
  distinguishes backtest / demo / verified live; connection state machine
  (`not_connected`, `connecting`, `live_demo`, `stale`, `offline`).
- **Remains disabled:** checkout, payments, downloads.

## QNT-0015 · Plans, purchase and rental

- **Prerequisites:** QNT-0013; plans table; pricing decisions.
- **Data involved:** plans (rental/purchase), orders (draft/pending_payment).
- **Security boundary:** `paid` set only server-side; price shown only from
  active plans; checkout cannot start for coming_soon/paused/deprecated.
- **Definition of done:** plan selection UI, order creation, checkout
  readiness gated by `canStartCheckout`, customer order history.
- **Remains disabled:** actual payment capture, downloads, licenses.

## QNT-0016 · Payment provider and webhooks

- **Prerequisites:** QNT-0015; provider decision (none chosen yet).
- **Data involved:** payments, provider webhooks.
- **Security boundary:** secret keys server-only; webhook signature
  verification; `providerReference` never exposed publicly.
- **Definition of done:** payment capture, webhook handling, order → paid
  transitions server-side, refund/cancel handling.
- **Remains disabled:** downloads, license activation (next phase).

## QNT-0017 · Licensing and protected delivery

- **Prerequisites:** QNT-0016; licenses + entitlements tables.
- **Data involved:** licenses, entitlements, protected files.
- **Security boundary:** download requires product `available` +
  `commercialDownloadEnabled` + license `active` + entitlement `granted`;
  final check server-side; private storage never in the bundle.
- **Definition of done:** license activation from paid orders, entitlement
  gating, protected EA delivery (EX5), activation limits if defined.
- **Remains disabled:** nothing listed here — the commercial flow is
  complete; monitoring continues to be separate.

---

## Visual goal (all phases)

Professional and modern; fast comprehension; simple purchase/rental flow;
transparency without exaggerated results; clear separation of backtest, demo
monitoring and verified live results. Demo/sample content never presented as
published product.
