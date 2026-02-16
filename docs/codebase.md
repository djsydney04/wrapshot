# Codebase Outline

## Top-Level Layout

```
ProdAI/
├── apps/                      # App surfaces
│   └── web/                   # Next.js 15 app (App Router)
├── packages/                  # Shared packages
│   ├── database/              # Prisma schema + client
│   ├── typescript-config/     # Shared tsconfigs
│   └── ui/                    # Shared UI components
├── docs/                      # Documentation hub
├── scripts/                   # One-off admin/ops scripts
├── supabase/                  # Supabase local config + migrations
├── turbo.json                 # Turbo pipeline
└── package.json               # Workspace root
```

## apps/web

```
apps/web/
├── app/                       # Route tree (App Router)
│   ├── (app)/                 # Auth-protected routes
│   ├── (auth)/                # Public auth routes
│   ├── api/                   # API routes (server)
│   └── middleware.ts          # App-level middleware
├── components/                # Reusable UI components
│   ├── ui/                    # shadcn/ui primitives
│   ├── layout/                # Header, sidebar, nav
│   ├── forms/                 # Entity forms
│   ├── scenes/                # Scene-related UI
│   └── providers/             # Context providers
├── lib/                       # Business logic + integrations
│   ├── actions/               # Server actions (CRUD)
│   ├── supabase/              # Supabase client setup
│   ├── stripe/                # Stripe client + helpers
│   ├── permissions/           # RBAC
│   └── stores/                # Zustand stores
└── public/                    # Static assets
```

## packages/database

```
packages/database/
├── prisma/
│   ├── schema.prisma          # Source of truth for data model
│   └── seed.ts                # Seed data
└── src/index.ts               # Prisma client export
```

## scripts

```
scripts/
└── admin-set-plan.ts          # Admin CLI to override user plan
```

## Where Things Live

- UI: `apps/web/components/`
- Routes: `apps/web/app/`
- Data access: `apps/web/lib/actions/` + `packages/database/`
- Auth and session: `apps/web/lib/supabase/` + `apps/web/middleware.ts`
- Billing: `apps/web/lib/stripe/` + `apps/web/app/api/billing/`
- AI features: `apps/web/app/api/scripts/` and `apps/web/app/api/receipts/`
