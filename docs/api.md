# API Reference

All API routes live under `apps/web/app/api/` and use Next.js route handlers.

## Auth Requirements

- All routes except `POST /api/webhooks/stripe` require an authenticated Supabase user.
- Stripe webhook requires a valid `stripe-signature` header and `STRIPE_WEBHOOK_SECRET`.

## Billing

### POST /api/billing/create-checkout

Creates a Stripe Checkout session.

Request:

```json
{ "planId": "PRO" | "STUDIO" }
```

Response:

```json
{ "url": "https://checkout.stripe.com/..." }
```

### POST /api/billing/create-portal

Creates a Stripe Billing Portal session.

Response:

```json
{ "url": "https://billing.stripe.com/..." }
```

## Scripts

### POST /api/scripts/breakdown

Starts AI script breakdown from a PDF.

Request:

```json
{ "scriptId": "...", "fileUrl": "https://..." }
```

Response:

```json
{ "success": true, "data": { "scenes": [], "total_pages": 0, "total_scenes": 0 }, "pageCount": 0 }
```

### GET /api/scripts/breakdown?scriptId=...

Checks breakdown status.

Response:

```json
{ "status": "IN_PROGRESS" | "COMPLETED" | "FAILED", "startedAt": "...", "completedAt": "...", "data": { "scenes": [] } }
```

## Receipts

### POST /api/receipts/parse

Parses a receipt image using Fireworks.

Request:

```json
{ "imageUrl": "https://..." }
```

Or:

```json
{ "imageBase64": "data:image/jpeg;base64,..." }
```

Response:

```json
{
  "vendor": "string | null",
  "amount": 0,
  "date": "YYYY-MM-DD",
  "description": "string | null",
  "lineItems": [{ "description": "...", "amount": 0 }],
  "confidence": 0.0
}
```

## Webhooks

### POST /api/webhooks/stripe

Handles Stripe events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Response:

```json
{ "received": true }
```
