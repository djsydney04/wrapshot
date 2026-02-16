# Load Map

This describes how the app boots and how requests flow through the system.

## Web App Boot

1. **Next.js entry**: `apps/web/app/layout.tsx` is the root layout.
2. **Route groups**:
   - `apps/web/app/(auth)/` for public auth flows
   - `apps/web/app/(app)/` for authenticated app routes
3. **Middleware**: `apps/web/middleware.ts` handles auth/session checks and redirects.
4. **Providers**: `apps/web/components/providers/` wires global context (auth, query, theme, etc.).

## Auth & Session

- Server-side session uses Supabase helpers in `apps/web/lib/supabase/`.
- Routes in `(app)` assume an authenticated user; `(auth)` is for login/signup.

## Data Flow

- **Server actions**: `apps/web/lib/actions/` encapsulate CRUD and write logic.
- **Database**: Prisma schema in `packages/database/prisma/schema.prisma`.
- **Client state**: Zustand stores in `apps/web/lib/stores/`.

## API Routes

- Server-side APIs live under `apps/web/app/api/`.
- Stripe webhooks run in `apps/web/app/api/webhooks/stripe/`.
- AI workflows (script breakdown, receipt parsing) run in `apps/web/app/api/scripts/` and `apps/web/app/api/receipts/`.

## External Services

- Supabase: auth + Postgres
- Stripe: billing + webhooks
- Fireworks: AI inference (receipt parsing, script breakdown)
