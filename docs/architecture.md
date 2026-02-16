# Architecture

This doc defines module boundaries, ownership, and how data flows across the system.

## Core Principles

- **App-first**: The product surface lives in `apps/web` and composes shared packages.
- **Thin UI, thick actions**: UI components call server actions and API routes for side effects.
- **Single source of truth**: Prisma schema in `packages/database` is the canonical data model.
- **Integrations behind adapters**: Stripe, Supabase, and AI providers live in `apps/web/lib/*`.

## Module Boundaries

### apps/web/app (Routing + Server)

- Owns the public contract of routes and APIs.
- Route groups:
  - `(auth)` for login/signup flows
  - `(app)` for authenticated views
  - `api/` for server endpoints
- Middleware enforces auth and request-level concerns.

### apps/web/components (UI)

- Pure UI or local interaction logic.
- Calls into:
  - `apps/web/lib/actions/*` for server mutations
  - `apps/web/app/api/*` for multi-step workflows

### apps/web/lib (Business Logic)

- `actions/`: server actions for CRUD and domain logic
- `supabase/`: auth/session setup
- `stripe/`: billing client and helpers
- `ai/` + `scripts/`: AI and script parsing helpers
- `types.ts`: shared domain types and constants used by UI

### packages/database (Data Model)

- Prisma schema defines all entities and relationships.
- Used by server actions and API routes via the Prisma client.

## Data Ownership

- **Projects, scenes, schedules, cast, crew**: owned by Prisma schema + server actions.
- **Auth/session**: owned by Supabase helpers and middleware.
- **Billing**: owned by Stripe with synchronization into the `Subscription` table.
- **AI outputs**: stored on `Script` records (`parsedContent`).

## Integration Points

### Supabase

- Auth and database access.
- Session checks occur in middleware and server actions.

### Stripe

- Checkout + portal sessions: `apps/web/app/api/billing/*`.
- Webhooks: `apps/web/app/api/webhooks/stripe/*`.
- Subscription state syncs back to Supabase tables.

### Fireworks AI

- Receipt parsing: `apps/web/app/api/receipts/parse`.
- Script breakdown: `apps/web/app/api/scripts/breakdown`.

## Recommended Boundaries When Adding Features

- New UI -> `apps/web/components`.
- New CRUD -> `apps/web/lib/actions`.
- New integration -> `apps/web/lib/<service>` + `apps/web/app/api/<feature>`.
- New DB types -> `packages/database/prisma/schema.prisma`.
