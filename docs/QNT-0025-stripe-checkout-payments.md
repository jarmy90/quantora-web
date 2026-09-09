# QNT-0025 · Stripe Checkout and Payments — Plan de implementación

**Estado:** documento de arquitectura. **No implementado.** `PAYMENTS_ENABLED=false`.
**Alcance:** productos propios de Quantora (alquiler por suscripción y/o compra por pago único, ambos sujetos a decisión humana). El marketplace de vendedores (Stripe Connect) es una fase posterior separada.

## 1. Principios no negociables

1. Ningún precio, product id o price id hardcodeado en componentes cliente: el catálogo comercial se resuelve **server-side** desde configuración privada.
2. Ningún secret en el bundle cliente. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y anyadidos viven solo en Vercel Environment Variables.
3. `paid` (y cualquier estado que habilite entrega) **solo** se establece desde el webhook firmado por Stripe. Nunca desde el cliente ni desde la success URL.
4. Verificación de firma del webhook sobre el **raw body** (antes de cualquier parseo JSON). En Nitro/Vercel: capturar el body crudo del request y verificar con `stripe.webhooks.constructEventAsync(rawBody, sig, secret)`.
5. Idempotencia: registrar `event.id` de Stripe y procesar cada evento exactamente una vez; operaciones de creación de sesión con `Idempotency-Key` derivada de orderId.
6. Stripe en **test mode** hasta aprobación explícita del propietario. Sin cobros reales.
7. Sin escrituras en Supabase live y sin migraciones hasta que el propietario apruebe el modelo.

## 2. Arquitectura propuesta (TanStack Start + Nitro)

- `src/domain/commercial/server.ts` (server functions):
  - `createCheckoutSession({ productId })`: valida producto contra el catálogo comercial server-side, exige sesión autenticada, crea la Checkout Session (mode `subscription` o `payment` según decisión humana), devuelve solo `url`. Nunca devuelve client_secret ni claves.
  - `getOrderStatus({ orderId })`: devuelve únicamente estado seguro (`created|pending|paid|failed|canceled`) para el dueño de la orden.
- `routes/api/stripe/webhook.ts` (endpoint Nitro, sin autenticación de sesión, verificado por firma):
  - Eventos: `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded` (según decisiones humanas).
  - Pipeline: raw body → verificación firma → idempotencia → actualización de orden → registro de evento.
- Customer mapping: tabla `stripe_customers` (user_id ↔ stripe_customer_id) creada en el primer checkout; el email de Supabase viaja en `customer_email`/`metadata.userId`.
- Success/cancel URLs: páginas dedicadas que **solo** leen estado server-side (`getOrderStatus`); la URL nunca otorga derechos.
- Receipts: emails nativos de Stripe + `receipt_url` persistido en la orden (auditoría). Reembolsos: solo desde panel Stripe; la sincronización con `charge.refunded` queda pendiente de política de reembolsos.

## 3. Modelo de datos propuesto (documento, sin migrar)

- `orders`: id (uuid), user_id, product_id, stripe_session_id, stripe_customer_id, mode (`subscription|payment`), status, amount_subtotal/total, currency, receipt_url, created_at, updated_at.
- `order_events`: id, order_id, type, stripe_event_id (único), payload_min, created_at.
- `webhook_events`: id, stripe_event_id (único), type, processed_at, status (`processed|skipped|failed`).
- `stripe_customers`: user_id (único), stripe_customer_id (único), created_at.

## 4. Estados de orden y transiciones

`created → pending → paid | failed | canceled` y `paid → refund_pending → refunded` (pendiente de política).
Solo el webhook (firma verificada + idempotencia) puede escribir `paid`, `refund_*` y estados de suscripción. El cliente solo lee.

## 5. Feature flags y activación

- `PAYMENTS_ENABLED=false` en producción hasta decisión humana explícita.
- Con flag false: ninguna ruta de checkout se registra; el CTA muestra estado "coming soon" actual.
- Activación requiere: decisiones humanas (sección 7), claves en Vercel, webhook registrado, pruebas E2E en test mode y aprobación del propietario.

## 6. Decisiones humanas pendientes (bloqueantes)

1. Modelo por producto: alquiler, compra o ambos.
2. Importe por producto (y si hay precios fundadores/descuentos).
3. Moneda (EUR/USD/multi-moneda).
4. Periodo de suscripción (mensual/anual).
5. Prueba gratuita (sí/no y duración).
6. Impuestos (Stripe Tax vs. precios con IVA incluido; responsabilidad fiscal).
7. Política de cancelación (inmediata vs. fin de periodo).
8. Política de reembolsos (ventana, condiciones).
9. Modelo de activaciones/licencias por compra (nº de activaciones MT5).
10. Actualizaciones incluidas (duración y alcance de las actualizaciones del EA).

## 7. Marketplace futuro — Stripe Connect (fase separada, no implementar aquí)

Documentado como fase independiente para vendedores:

- **Onboarding de cuenta conectada:** Express Account recomendada (KYC/hosting de onboarding gestionado por Stripe, mínimo esfuerzo de cumplimiento para Quantora).
- **Separación clave:** aprobación técnica del EA (Quantora) ≠ capacidad de cobro (Stripe Connect). Un vendedor puede estar aprobado técnicamente y no poder cobrar hasta que `charges_enabled` y `payouts_enabled` sean true.
- **Application fee:** comisión de Quantora por venta/alquiler de terceros (porcentaje y/o fijo — decisión humana futura).
- **Payouts:** programación y retenciones; los fondos de vendedores nunca pasan por el balance propio sin Connect.
- **Refunds y disputes:** responsabilidad compartida según política; `charge.dispute.created` suspende la ficha hasta resolución.
- **Tax responsibilities:** documentar quién asume impuestos; Stripe Tax como opción.
- **Seller status:** máquina de estados propia (`pending_onboarding → restricted → enabled → suspended`) sincronizada con `account.updated`.

## 8. Fases de implementación (cuando el propietario apruebe)

1. Catálogo comercial server-side + tabla orders + webhook idempotente (test mode).
2. Checkout Session + success/cancel + estados de orden.
3. Subscripciones (alquiler) con `customer.subscription.*`.
4. Receipts + administración de reembolsos (según política).
5. Revisión de seguridad (sin secrets en cliente, raw body, idempotencia) y activación con `PAYMENTS_ENABLED=true`.

