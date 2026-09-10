# QNT-0025 · Stripe Test Mode (compra 300 € / alquiler 10 €/mes)

Circuito de pago en **TEST** de punta a punta. Sin cobros reales.
Decisiones fijas: compra 300 EUR pago único · alquiler 10 EUR/mes ·
moneda EUR · Checkout · `paid` solo por webhook firmado · la página de
éxito nunca concede acceso · sin EX5/SET en el repo · sin Connect.

## 1. Variables de entorno (Vercel → proyecto → Settings → Environment Variables)

Solo en el entorno de **test/preview** (nunca en Production hasta el
lanzamiento comercial):

| Variable | Valor | Notas |
|---|---|---|
| `PAYMENTS_ENABLED` | `true` | server-only, sin prefijo `VITE_` |
| `APP_URL` | URL de la preview (p.ej. `https://<preview>.vercel.app`) | usada para success/cancel URLs |
| `STRIPE_SECRET_KEY` | `sk_test_...` | **test**, server-only, nunca en cliente ni logs |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (del endpoint de test) | server-only |

En **Production** hoy: `PAYMENTS_ENABLED=false` (sin CTAs de compra, sin
checkout real). `DOWNLOADS_ENABLED=false` siempre en esta fase.

## 2. Productos y precios en Stripe Test Mode

Sin SDK nuevo: el servidor crea Checkout Sessions vía REST con
`price_data` inline (sin price IDs hardcodeados en el cliente):

- Compra: `unit_amount=30000`, `currency=eur`, `mode=payment`
- Alquiler: `unit_amount=1000`, `currency=eur`, `mode=subscription`,
  `recurring[interval]=month`

Los importes viven solo en `src/domain/payments/prices.ts` (servidor).
El cliente solo envía `{ productId, billingModel }`.

## 3. Webhook (firmado, idempotente)

Endpoint futuro recomendado: `POST /api/stripe/webhook` con el **raw body**
(sin parsear a JSON antes de verificar):

1. Leer `Stripe-Signature` y el raw body.
2. `verifyStripeSignature(rawBody, header, STRIPE_WEBHOOK_SECRET)` —
   HMAC-SHA256 `t.body`, tolerancia 300 s.
3. `applyStripeWebhookEvent(record, { eventId: event.id, type: event.type })`
   — idempotente por event id; `checkout.session.completed` /
   `invoice.paid` → `paid` (compra) o `active` (alquiler).

Apuntar el webhook de test:

```bash
stripe listen --forward-to https://<preview>/api/stripe/webhook
stripe trigger checkout.session.completed
```

o Dashboard → Developers → Webhooks → endpoint de test con los eventos
`checkout.session.completed`, `invoice.paid`,
`checkout.session.expired`, `charge.refunded`.

## 4. Probar compra y alquiler en test

1. Desplegar la preview con las env vars de test.
2. Login con usuario de prueba → abrir una ficha de estrategia.
3. "Buy 300 €" → Checkout de Stripe en test (tarjeta `4242 4242 4242 4242`)
   → success informativo (no concede acceso por sí solo).
4. "Rent 10 €/mo" → suscripción test → `invoice.paid` → `active`.
5. Verificar idempotencia reenviando el evento (segunda entrega = no-op).
6. `/account` muestra el historial (vacío honesto hasta persistencia real).

## 5. Pendiente para producción (NO hacer ahora)

- Claves live (`sk_live_...`, `whsec_...` live) y `PAYMENTS_ENABLED=true`.
- Persistencia real (Supabase: orders/payments/licenses/entitlements).
- Endpoint webhook desplegado + secreto live configurado.
- PDF de instalación, descargas EX5, soporte y reembolsos.
- Stripe Connect / sellers: fase separada.
