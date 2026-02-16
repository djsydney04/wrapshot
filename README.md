# Wrapshoot - Film Production Management Platform

AI-powered film production scheduling and management platform designed to help modern filmmakers organize scenes, schedules, call sheets, budgets, and crew logistics in a single, intuitive interface.

## Tech Stack

### Core
- **Framework**: Next.js 15 (App Router with React Server Components)
- **Language**: TypeScript 5.7
- **Runtime**: React 19
- **Styling**: Tailwind CSS 3.4

### UI & Components
- **Component Library**: shadcn/ui + Radix UI primitives
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Data Tables**: TanStack React Table
- **Drag & Drop**: @dnd-kit (core, sortable, utilities)
- **Command Palette**: cmdk
- **Toasts**: Sonner

### Backend & Data
- **Backend**: Next.js Server Actions + API Routes
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma 5.x
- **Auth**: Supabase Auth (email/password)
- **Real-time**: Liveblocks (foundation for collaboration)

### State Management
- **Client State**: Zustand 5.0
- **Server Cache**: TanStack React Query 5.x

### Integrations
- **Payments**: Stripe (subscriptions & billing)
- **Email**: Resend (transactional emails)
- **Job Queue**: Inngest (background jobs)
- **Analytics**: PostHog + Sentry (error tracking)
- **AI**: Anthropic Claude API (planned for script breakdown)

### Build Tools
- **Monorepo**: Turbo 2.7 + npm workspaces
- **Node**: 18+ required

---

## Quick Start

See [docs/setup.md](./docs/setup.md) for detailed setup instructions.

### Prerequisites

- Node.js 18+
- npm 10.x
- A Supabase account ([supabase.com](https://supabase.com))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables (see docs/setup.md)
cp .env.example .env.local
# Fill in your Supabase credentials

# 3. Generate Prisma client
npm run db:generate

# 4. Push database schema to Supabase
npm run db:push

# 5. Seed sample data
npm run db:seed

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up for an account.

---

## Documentation

- docs/README.md
- docs/codebase.md
- docs/architecture.md
- docs/load-map.md
- docs/usage.md
- docs/api.md
- docs/setup.md
- docs/implementation-guides/finance.md
- docs/finance-flow.md

## Project Structure

```
ProdAI/
├── apps/
│   └── web/                          # Next.js 15 application
│       ├── app/
│       │   ├── (app)/                # Protected routes (require auth)
│       │   │   ├── page.tsx          # Dashboard home
│       │   │   ├── layout.tsx        # App layout with sidebar
│       │   │   ├── projects/         # Project management
│       │   │   │   ├── page.tsx      # Projects list
│       │   │   │   ├── new/          # Create project wizard
│       │   │   │   └── [projectId]/  # Project detail & sub-pages
│       │   │   ├── schedule/         # Shooting schedule views
│       │   │   ├── finance/          # Budget & financial tracking
│       │   │   ├── settings/         # User & team settings
│       │   │   ├── invites/          # Project invitation handling
│       │   │   └── onboarding/       # First-time user setup
│       │   ├── (auth)/               # Public auth routes
│       │   │   ├── login/
│       │   │   ├── signup/
│       │   │   └── forgot-password/
│       │   ├── auth/                 # Auth callbacks
│       │   │   ├── callback/         # OAuth redirect handler
│       │   │   └── signout/
│       │   └── api/                  # API routes
│       │       ├── billing/          # Stripe checkout/portal
│       │       └── webhooks/stripe/  # Stripe webhook handler
│       ├── components/
│       │   ├── ui/                   # shadcn/ui primitives
│       │   ├── forms/                # Entity forms (project, scene, cast, etc.)
│       │   ├── layout/               # Sidebar, header, navigation
│       │   ├── projects/             # Project-specific components
│       │   ├── scenes/               # Scene management UI
│       │   ├── calendar/             # Calendar views
│       │   └── providers/            # React context providers
│       ├── lib/
│       │   ├── supabase/             # Supabase client setup
│       │   │   ├── client.ts         # Browser client
│       │   │   ├── server.ts         # Server client
│       │   │   └── middleware.ts     # Auth middleware
│       │   ├── actions/              # Server Actions (all CRUD)
│       │   │   ├── projects.ts
│       │   │   ├── scenes.ts
│       │   │   ├── cast.ts
│       │   │   ├── locations.ts
│       │   │   ├── shooting-days.ts
│       │   │   ├── budgets.ts
│       │   │   └── project-members.ts
│       │   ├── permissions/          # RBAC authorization
│       │   │   ├── index.ts          # Role definitions
│       │   │   └── server.ts         # Permission checks
│       │   ├── stores/               # Zustand stores
│       │   └── stripe/               # Stripe utilities
│       └── middleware.ts             # Next.js auth middleware
├── packages/
│   ├── database/                     # Prisma package
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Complete database schema
│   │   │   └── seed.ts               # Sample data seeder
│   │   └── src/index.ts              # Prisma client export
│   └── typescript-config/            # Shared TS configs
├── supabase/                         # Supabase local config
│   └── migrations/
├── turbo.json                        # Build orchestration
├── .env.example                      # Environment template
└── package.json                      # Workspace root
```

---

## Features

### Completed (MVP)

**Project Management**
- Create, edit, and delete film projects
- Project status tracking (Development → Post-Production)
- Multi-user project access with role-based permissions
- Project invitations via email with token-based acceptance

**Scene Breakdown**
- Add scenes with script details (scene number, synopsis)
- INT/EXT and DAY/NIGHT categorization
- Page count tracking (in eighths)
- Scene status workflow (NOT_SCHEDULED → COMPLETED)
- Assign cast and elements to scenes

**Cast Management**
- Cast member profiles with character names
- Contract dates and rates (daily/weekly)
- Agent information and contact details
- Cast availability calendar
- Work status tracking (ON_HOLD → WRAPPED)

**Location Management**
- Location database with addresses and coordinates
- Permit status tracking
- Technical notes (parking, load-in, sound)
- Backup location support

**Shooting Schedule**
- Calendar-based schedule view
- Shooting day creation with multi-unit support
- Assign scenes to shooting days with drag-and-drop
- Cast call times per shooting day
- Weather and special notes

**Call Sheets**
- Auto-generated from shooting days
- Department-specific call times
- Safety and logistics information
- PDF export

**Team & Permissions**
- Organization and project-level roles
- Role-based access control (RBAC)
- Permission matrix for all features
- Team invitation system

**Billing**
- Stripe subscription integration
- Free, Pro, and Studio plans
- Usage limits enforcement

### In Progress

**Finance Module**
- Budget creation with templates
- Budget categories (hierarchical)
- Line items with quantities and rates
- Transaction/expense tracking
- Budget vs. actual reporting

### Planned (Phase 2)

- AI script breakdown via Claude API
- AI schedule optimization
- Real-time collaboration (Liveblocks)
- Production reports
- Google Calendar sync
- Slack notifications
- Mobile apps

---

## Data Models

### Core Entities

| Entity | Description |
|--------|-------------|
| `Organization` | Company/studio that owns projects |
| `Project` | Film/production with all related data |
| `Scene` | Individual scene with INT/EXT, DAY/NIGHT, page count |
| `CastMember` | Actor with character, rates, availability |
| `Location` | Shooting location with permits and contacts |
| `Element` | Props, wardrobe, vehicles, VFX, etc. |
| `ShootingDay` | Scheduled production day with scenes and cast |
| `CallSheet` | Published call sheet for a shooting day |
| `Budget` | Project budget with categories and line items |
| `Transaction` | Expense/payment against budget items |

### Authorization Entities

| Entity | Description |
|--------|-------------|
| `OrganizationMember` | User membership in an org (OWNER, ADMIN, MEMBER) |
| `ProjectMember` | User role on a project (ADMIN → VIEWER) |
| `ProjectInvite` | Pending invitation with token |
| `Subscription` | Stripe subscription for billing |

### Project Roles & Permissions

```
ADMIN           - Full access: read, write, delete, manage team
COORDINATOR     - Schedule & scene management, no team management
DEPARTMENT_HEAD - Manage their department, view project
CREW            - Read project, view/edit schedule
CAST            - View scenes and call times only
VIEWER          - Read-only access
```

See `apps/web/lib/permissions/index.ts` for the complete permission matrix.

---

## Architecture Patterns

### Server Actions

All data mutations use Next.js Server Actions in `lib/actions/`:

```typescript
// lib/actions/projects.ts
"use server";

export async function createProject(data: CreateProjectData) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  // Check plan limits
  const canCreate = await checkPlanLimit(userId, "projects");
  if (!canCreate) throw new Error("PLAN_LIMIT_REACHED");

  // Create project and add user as ADMIN
  const project = await prisma.project.create({ data });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId, role: "ADMIN" }
  });

  revalidatePath("/projects");
  return project;
}
```

### Permission Checking

```typescript
// In server actions or API routes
import { requireProjectPermission } from "@/lib/permissions/server";

export async function updateScene(projectId: string, sceneId: string, data) {
  await requireProjectPermission(projectId, "scenes:write");
  // Proceed with update...
}
```

### Form Components (React Hook Form + Zod)

```typescript
// components/forms/add-scene-form.tsx
const schema = z.object({
  sceneNumber: z.string().min(1),
  synopsis: z.string().optional(),
  intExt: z.enum(["INT", "EXT", "BOTH"]),
  dayNight: z.enum(["DAY", "NIGHT", "DAWN", "DUSK"]),
});

export function AddSceneForm({ projectId }: Props) {
  const form = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    await createScene(projectId, data);
    toast.success("Scene created");
  };

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
}
```

### Zustand Stores

```typescript
// lib/stores/project-store.ts
export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
}));
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Database (from Supabase)
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...

# Stripe (optional for billing)
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_STUDIO_PRICE_ID=price_...

# Email (optional)
RESEND_API_KEY=re_...

# AI (planned)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Development Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build            # Build for production
npm run lint             # Run ESLint
npm run typecheck        # TypeScript checking

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database (no migration)
npm run db:migrate       # Create migration file
npm run db:seed          # Seed sample data
npm run db:studio        # Open Prisma Studio (port 5555)
```

---

## Sample Data

After running `npm run db:seed`, you'll have:

- **1 Organization**: Acme Productions
- **1 Project**: Demo Feature Film (Pre-Production)
- **5 Cast Members**: With characters, rates, and availability
- **3 Locations**: Coffee Shop, Park, Warehouse
- **5 Scenes**: Fully populated with cast and elements
- **3 Shooting Days**: Scheduled with scenes
- **1 Call Sheet**: Ready to view/edit

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/web/middleware.ts` | Auth session refresh |
| `apps/web/app/(app)/layout.tsx` | Protected app layout |
| `apps/web/lib/supabase/server.ts` | Server-side Supabase client |
| `apps/web/lib/permissions/index.ts` | Role-permission mappings |
| `apps/web/lib/permissions/server.ts` | Permission check utilities |
| `apps/web/lib/actions/*.ts` | All Server Actions |
| `apps/web/components/layout/sidebar.tsx` | Main navigation |
| `packages/database/prisma/schema.prisma` | Database schema |

---

## Adding New Features

1. **Schema**: Add model to `packages/database/prisma/schema.prisma`
2. **Push**: Run `npm run db:push` to update database
3. **Actions**: Create server action in `apps/web/lib/actions/`
4. **Permissions**: Update `lib/permissions/index.ts` if needed
5. **Form**: Create form component in `apps/web/components/forms/`
6. **Page**: Add route in `apps/web/app/(app)/`
7. **Nav**: Add link to `components/layout/sidebar.tsx`

---

## Troubleshooting

See [SETUP.md](./SETUP.md) for detailed troubleshooting.

| Issue | Solution |
|-------|----------|
| Database connection error | Check `DATABASE_URL` and `DIRECT_URL` in `.env.local` |
| Prisma client not found | Run `npm run db:generate` |
| Auth redirect loop | Clear cookies, check Supabase URL config |
| Email not arriving | Check spam or disable email confirmation in Supabase |
| Port 3000 in use | Kill process or use `npm run dev -- -p 3001` |

---

## Architecture Decisions

### Why Supabase?
- All-in-one: Auth + Database + Storage + Real-time
- PostgreSQL with direct access via Prisma
- Row Level Security for fine-grained permissions
- Generous free tier, can self-host

### Why Server Actions over API Routes?
- Type-safe end-to-end with TypeScript
- Automatic revalidation with `revalidatePath`
- Simpler code organization
- Built-in CSRF protection

### Why Zustand over Redux?
- Minimal boilerplate
- TypeScript-first
- No providers needed
- Works with Server Components

---

## License

MIT
