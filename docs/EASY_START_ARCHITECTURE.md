# Quantora Easy Start · Architecture (QNT-0014)

## Objective for beginners

Easy Start is an educational, visual onboarding that lets a beginner answer,
in seconds: **“I can install this bot myself.”** It walks a user through
installing a compiled Expert Advisor in MetaTrader 5 and testing it safely on
a demo account — with **no programming** and, in the standard flow, **no
MetaEditor** and **no compilation**.

Main message: *Install your strategy in MetaTrader 5 in 3 simple steps.*
Complementary: *No programming required.* Recommendation: *Start safely with
a demo account.*

This phase is purely informational: **nothing activates** products, plans,
prices, purchase, rental, checkout, payments, licenses, entitlements,
downloads, real EA files or demo monitoring.

## EX5 vs MQ5 (delivery decision)

The standard commercial delivery is the **compiled `.ex5`** Expert Advisor
plus, when provided for a strategy, a **Recommended settings file (`.set`)**
and a **visual quick-start guide**.

- The normal user installs a compiled `.ex5` — no MetaEditor, no compiler.
- The `.mq5` **source code is private intellectual property** and is **not**
  part of the standard commercial delivery. It must never ship to clients,
  never appear in the bundle or the public repo, and never be committed.
- We do not claim every future product will include a `.set`. We say:
  **“Recommended settings file, when provided.”** and “The settings file is
  included only when available for that strategy.”

## Demo-first

Step 3 is explicit: attach the EA to a chart and **start in a clearly
identified demo account**, never live first. The guide warns:
*Do not begin with a live account.* One of the checklist items is **Demo
account confirmed**. No real MT5 account, no broker, no credentials and no
balances are ever involved.

## Public vs client content

- **Public** (this phase): the `/how-to-install` guide, the reusable
  `EasyStartSteps` component (full / compact / preview), home & strategy
  sections, `/account` entry. No secrets, no private paths, no vault, no
  real file names, no personal data.
- **Client** (future, QNT-0018+): licensed/entitlement-gated files (`.ex5`,
  `.set`, guide) delivered from private protected storage through a
  server-side check — never from the browser bundle.

The component is **informational only** and is **never a security boundary**;
download/licensing gating remains entirely server-side.

## Future integration

- **Licensing & protected delivery (QNT-0018):** the `.ex5` / `.set` /
  quick-start guide described here become the actual protected delivery set.
  Easy Start already names the exact files (`your-strategy.ex5`,
  `recommended-settings.set`, `quick-start-guide`) so the educational copy
  stays truthful when real delivery lands.
- **Demo monitoring (QNT-0015):** the guide tells users to *test in demo
  first*; the future demo-monitoring module continues to clearly separate
  **backtest** vs **demo monitoring** vs **verified live result** — never
  conflated.

## Frequent problems (covered in the guide)

- Strategy does not appear in Navigator → refresh Expert Advisors, restart
  MT5, confirm the `.ex5` is inside `MQL5/Experts`.
- Algo Trading not enabled → enable it; the EA must be allowed to trade.
- Wrong instrument/timeframe → use the one the strategy indicates.
- Settings not loaded → load the `.set` when provided.

## Accessibility

- Heading order is preserved; steps are understandable without color.
- Visuals carry `role="img"` + `aria-label` and are decorative — the step
  text always carries the meaning (images never hold the only explanation).
- Links/buttons have accessible names; keyboard navigation and visible focus
  follow the site theme; touch targets are comfortable; the guide stacks
  cleanly at 390 px; animations, where any, respect `prefers-reduced-motion`.
