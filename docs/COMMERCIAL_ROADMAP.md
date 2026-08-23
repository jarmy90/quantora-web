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

**Status: implemented and live-verified.**

- **Prerequisites:** QNT-0012 contracts; `.env.example`; customers table.
- **Data involved:** customers, session state (Supabase Auth, HttpOnly cookie).
- **Security boundary:** Supabase Auth (email + password), server-side session
  verification via `getUser(token)`, HttpOnly/SameSite/Lax cookies, safe
  `returnTo` (internal paths only), service-role key never used.
- **Definition of done (code):** registration, login, logout, password reset
  request + new-password flow, email-verification callback, protected
  `/account`, auth↔customer relation migration (`0002`), `AUTH_NOT_CONFIGURED`
  state, tests + CI step. See `docs/AUTHENTICATION.md`.
- **Live verification record (no personal data):** the Quantora Supabase
  project is configured; migrations `0001` + `0002` applied via SQL Editor;
  email registration verified; email confirmation verified; login verified;
  protected `/account` verified; logout verified; password recovery verified;
  one owner-controlled test account exists; zero orders, payments, licenses,
  entitlements and downloads.
- **No longer pending:** creating the project, configuring variables, applying
  migrations, live auth verification.
- **Remains disabled:** purchases, payments, downloads, demo monitoring.

## QNT-0014 · Easy Start installation onboarding

- **Rationale:** installation onboarding ships BEFORE payments because it
  reduces fear and abandonment before the conversion moment — a beginner
  who understands “I can install this bot myself” is far more likely to
  buy or rent later.
- **Prerequisites:** QNT-0013 auth + live Supabase; four public strategies;
  `coming_soon` products.
- **Data involved:** none new; purely visual/educational (public route
  `/how-to-install`, reusable `EasyStartSteps` component).
- **Security boundary:** informational only — no downloads, no license
  fiction, no MT5 credentials, no real EA files, no private source.
- **Definition of done:** three-step public guide (Download → Install in
  MT5 → Test in demo), compact block on strategy details, home section,
  `/account` guide entry; demo-first messaging; responsive visuals;
  accessibility and SEO.
- **Remains disabled:** products, plans, payments, downloads, licenses,
  demo monitoring.

## QNT-0015 · Product plans & conversion preview (this phase)

**Status: implemented.**

- **Product plans UX:** implemented.
- **Active prices:** not implemented.
- **Checkout:** not implemented.
- **Payments:** not implemented.
- **Licensing:** not implemented.
- **Downloads:** not implemented.
- **Demo monitoring:** coming_soon.
- **Prerequisites:** QNT-0014 merged; four coming_soon products; Supabase auth.
- **Data involved:** none persisted. A presentation view-model
  (`ProductOfferViewModel` in `src/domain/commercial/productOffer.ts`) derived
  from the safe public catalog. All four products stay `coming_soon`;
  StochExtreme Gold stays `not_listed`.
- **Security boundary:** no orders, checkout, payment, licence or download;
  CTA resolved from derived availability + auth; `returnTo` internal-only;
  selector changes local visual state only and never calls Supabase.
- **Definition of done:** canonical `/products/$productId` route, access-mode
  selector (monthly highlighted; quarterly/annual/purchase coming soon),
  pre-checkout summary, safe login-return flow, auth-aware strategy-detail CTA,
  account product links, installation onboarding module; tests + CI step.
- **Remains disabled:** active prices, checkout, orders, payments,
  subscriptions, licenses, downloads, demo telemetry.

## QNT-0016 · Demo monitoring pilot

- **Prerequisites:** server functions infrastructure; safe product linkage.
- **Data involved:** demo-account monitoring records per strategy.
- **Security boundary:** demo data is separate from backtest and from
  verified live results; clearly labelled; no invented balances.
- **Definition of done:** a pilot module (labelled DEMO MONITORING) that
  distinguishes backtest / demo / verified live; connection state machine
  (`not_connected`, `connecting`, `live_demo`, `stale`, `offline`).
- **Remains disabled:** checkout, payments, downloads.

## QNT-0017 · Plans, purchase and rental (checkout)

- **Prerequisites:** QNT-0013; QNT-0015 plans preview; plans table; pricing decisions.
- **Data involved:** plans (rental/purchase), orders (draft/pending_payment).
- **Security boundary:** `paid` set only server-side; price shown only from
  active plans; checkout cannot start for coming_soon/paused/deprecated.
- **Definition of done:** plan selection UI, order creation, checkout
  readiness gated by `canStartCheckout`, customer order history.
- **Remains disabled:** actual payment capture, downloads, licenses.

## QNT-0018 · Payment provider and webhooks

- **Prerequisites:** QNT-0016; provider decision (none chosen yet).
- **Data involved:** payments, provider webhooks.
- **Security boundary:** secret keys server-only; webhook signature
  verification; `providerReference` never exposed publicly.
- **Definition of done:** payment capture, webhook handling, order → paid
  transitions server-side, refund/cancel handling.
- **Remains disabled:** downloads, license activation (next phase).

## QNT-0019 · Licensing and protected delivery

- **Prerequisites:** QNT-0017; licenses + entitlements tables.
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
