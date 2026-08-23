# Quantora · Commercial Architecture (QNT-0012)

Status: **foundation only** — nothing commercial is active. This document
records the architectural decisions made in QNT-0012 so future phases
(QNT-0013..QNT-0017) build on contracts and state rules instead of ad-hoc
React components.

## 1. Current infrastructure (verified, not assumed)

- **Framework:** TanStack Start (React + Vite + Tailwind), served on port
  3000 (`serve.ts`, Bun) for the preview; Vercel via `vercel-entry.ts` and
  `go-live.sh` for production hosting (requires `VERCEL_TOKEN`, never run in
  this workspace).
- **Database:** `@neondatabase/serverless` is declared and `src/db.ts`
  exposes a lazy, server-only `sql()` handle reading `DATABASE_URL`.
  **No database connection is demonstrated**: `DATABASE_URL` is not set in
  this environment, and **no tables or migrations exist yet** (the schema in
  `db/migrations/0001_commercial_foundation.sql` is preparatory and has not
  been applied anywhere). We do not claim an active database.
- **Server functions:** TanStack Start `createServerFn` is supported; the
  only server surface added is the read-only `getCommercialCatalog`.
- **Environment:** Bun auto-loads `.env`; `serve.ts`/`go-live.sh` read
  `process.env`. There is no `.env` file and no `.env.example` prior to this
  phase (`.env.example` is added by QNT-0012).
- **Public data:** `public-strategies/catalog.json` (generated, versioned)
  carries the four strategies with `productId`, `productStatus`
  (`coming_soon`) and `commercialDownloadEnabled=false`.

## 2. Entity separation (definitive)

1. **Strategy ≠ Product.** A strategy is the evaluated research/backtest
   entity (`strategyId`, public catalog). A product is the commercial EA
   attached to it (`productId`, e.g. `first-triangle-ustec-m30`). They are
   different identities; the mapping lives in the public catalog and the
   migration seed.
2. **Product ≠ Plan.** A product exists regardless of any commercial
   modality. A plan (rental/purchase × monthly/quarterly/annual/one-time) is
   a pricing modality *of* a product. Plans start `draft` with null prices.
3. **Order ≠ Payment ≠ License.** An order is purchase intent; a payment is
   the provider transaction; a license is the granted right. `paid` on an
   order can only be set server-side. A license cannot be `active` without a
   `paid` order.
4. **Private storage ≠ customer delivery.** Source EAs, vault paths and
   private hashes never enter the public bundle. Future protected delivery
   (QNT-0017) will serve files from private storage through a server-side
   entitlement check.

## 3. State machines (implemented in `src/domain/commercial/rules.ts`)

- `canPurchaseProduct(product)` — only `available`.
- `canSelectPlan(plan)` — only `active` **and** carrying a real price
  (`priceAmountMinor > 0`, `currency` set). `draft`/`inactive` are never
  selectable; null price is never zero.
- `canStartCheckout(product, plans)` — purchasable product **and** a
  selectable plan.
- `canMarkOrderPaidFromClient()` — always `false` (hard rule).
- `canMarkPaymentSucceeded(payment)` — requires `orderId`.
- `canActivateLicense(license, order)` — license `pending` **and** order
  `paid`.
- `canGrantDownload({product, license, entitlement})` — product
  `available` **and** `commercialDownloadEnabled=true` **and** license
  `active` **and** entitlement `granted` **and** `canDownload=true`.
- `getProductAvailability(product, plans)` — public, derived, never a
  security boundary.

With current data every check returns `false`: four products are
`coming_soon`, `commercialDownloadEnabled=false`, no active plans, no
orders, no payments, no licenses, no granted entitlements.

## 4. Public vs private data

- **Public (client-safe):** productId, strategyId, displayName, productStatus,
  deliveryFormat, commercialDownloadEnabled, derived availability.
- **Private (server-only, never in the bundle):** `providerReference`,
  `DATABASE_URL`, `AUTH_SECRET`, `PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET`,
  vault paths, filenames, private hashes, source archives.
- The safe catalog (`src/commercial/catalog.ts`) exposes only the public
  list and never duplicates metrics or strategy data.

## 5. Security boundaries

- Feature flags (`AUTH_ENABLED`, `PAYMENTS_ENABLED`, `DOWNLOADS_ENABLED`,
  `DEMO_MONITORING_ENABLED`) default to **false** and live server-side;
  the client only ever receives the derived booleans from
  `getPublicFeatureFlags()`.
- No `VITE_` variable carries a secret.
- `src/config.ts` never returns raw env values; error messages report
  presence, not values.
- The UI is never the security boundary: future final checks (download,
  license activation) run server-side.

## 6. Decisions

**Definitive now:**
- Entity separation (strategy/product/plan/order/payment/license/entitlement).
- State sets and state rules above.
- Prices in integer minor units; null while draft.
- No passwords, no credentials, no personal data in this phase.
- Feature flags default false; commercial capabilities disabled.

**Pending (decided in later phases, not invented here):**
- Authentication provider and session mechanism (QNT-0013).
- Password hashing / identity provider (QNT-0013).
- Email provider (QNT-0013).
- Demo-monitoring pilot mechanics (QNT-0014).
- Pricing amounts, currency and plan final shapes (QNT-0015).
- Payment provider and webhooks (QNT-0016).
- Licensing rules (maxActivations), protected delivery mechanics (QNT-0017).
- Database connection and migration execution (authorization required).

## 7. What QNT-0013..QNT-0017 must do

See `docs/COMMERCIAL_ROADMAP.md` for the phase-by-phase contract.
