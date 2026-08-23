# Quantora · Product Plans and Conversion (QNT-0015)

This phase adds the **presentation layer** for product access modes, plans and
a pre-checkout conversion flow — without enabling prices, checkout, orders,
payments, licenses or downloads. It is the visual and contractual foundation
for the later checkout phase (roadmap QNT-0017 onwards).

## Modalidades (access modes)

- **Rental** — recurring: monthly, quarterly, annual.
- **Purchase** — one-time.

For the visual pilot only the **monthly rental** is shown as the highlighted
(future initial) mode. Quarterly, annual and purchase are displayed as
**Coming soon**. No amounts are assigned to any mode: the UI shows
"Available soon" and a clear note that prices and availability will be
announced before checkout is enabled.

**Nothing is charged or stored.** The selector only changes local visual
state; it never submits, never calls Supabase and never creates an order.

## Estados (product status)

- `not_listed` — never rendered publicly (e.g. StochExtreme Gold).
- `coming_soon` — informational, explorable; no order/checkout/download.
- `available` — contract prepared; not used yet (all products remain
  `coming_soon`).
- `paused` — temporary unavailability.
- `deprecated` — contracting hidden, historical info preserved.

All four public products remain `coming_soon` and
`commercialDownloadEnabled = false`. `canStartCheckout = false`,
`canDownload = false` for all.

## Ruta de producto

`/products/:productId` resolves only the four mapped products. Any other or
invalid id returns a **safe 404** ("Product not found").

The page shows: name, market, timeframe, availability, the highlighted mode,
a mode selector, a local summary card, "What will be included", requirements,
limitations, the three-step conversion path and a short installation module.

## Recorrido de conversión

1. Choose a strategy (works).
2. Select your mode (preview only).
3. Activate your access (disabled until checkout exists).

A breadcrumb links Home → Catalog → Product, and each product links back to
its historical backtest and to the installation guide.

## Return to / login

From the strategy detail, an anonymous user sees **"Sign in to continue"**,
which stores a safe **internal** `returnTo` (`/products/:id`) and goes to
`/login`. After sign-in the user returns to the product preview. External
URLs, protocols, `javascript:`, protocol-relative and backslash tricks are
rejected by the existing `isSafeReturnTo` / `sanitizeReturnTo` helpers.
Authenticated users see **"See options"** leading straight to the product page.

## CTA / ausencia de transacciones

No "Buy now", "Rent now", "Download" or active checkout appears. "Notify me"
remains an informational dialog that never persists data or confirms a list.
The strategy detail and product pages never call a payment provider and never
create orders, payments, licenses or downloads.

## Dashboard / account

`/account` lists the four `coming_soon` products with a **"See options"** link
to their product page. Empty states remain honest: strategies = 0, licenses =
0, billing empty. No prices, subscriptions, renewals or downloads are shown.

## Próximos pasos

- QNT-0016 · demo monitoring pilot.
- QNT-0017 · plans/purchase/rental including real order creation and checkout
  readiness gated by `canStartCheckout`.
- QNT-0018 · payment provider and webhooks.
- QNT-0019 · licensing and protected delivery.

Decisions that remain open and are NOT decided here: payment provider, prices,
billing currency, tax handling, refunds, promo codes, and any pricing strategy.
