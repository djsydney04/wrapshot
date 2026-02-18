# Wrapshoot - Film Production Management Platform

Smart film production scheduling and management platform designed to help modern filmmakers organize scenes, schedules, call sheets, budgets, and crew logistics in a single, intuitive interface.

## Tech Stack

### Core
- **Framework**: Next.js 16 (App Router with React Server Components)
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
- **Real-time**: Supabase Realtime + Liveblocks

### State Management
- **Client State**: Zustand 5.0
- **Server Cache**: TanStack React Query 5.x

### Integrations
- **Payments**: Stripe (subscriptions & billing)
- **Email**: Resend (transactional emails)
- **Job Queue**: Inngest (background jobs)
- **Analytics**: PostHog + Sentry (error tracking)
- **Smart Features**: Cerebras GLM (LLM-powered script analysis) + Fireworks (receipt OCR fallback)

### Build Tools
- **Monorepo**: Turbo 2.8 + npm workspaces
- **Node**: 18+ required

---

## Features

### Project Management
- Create, edit, and delete film projects
- Project status tracking (Development → Post-Production)
- Multi-user project access with role-based permissions
- Project invitations via email with token-based acceptance
- Setup wizard for new projects

### Scene Breakdown
- Add scenes with script details (scene number, synopsis)
- INT/EXT and DAY/NIGHT categorization
- Page count tracking (in eighths)
- Scene status workflow (NOT_SCHEDULED → COMPLETED)
- Assign cast and elements to scenes
- Bulk scene management

### Cast & Crew Management
- Cast member profiles with character names
- Contract dates and rates (daily/weekly)
- Agent information and contact details
- Cast availability calendar
- Work status tracking (ON_HOLD → WRAPPED)
- Crew invitations with role-based access

### Location Management
- Location database with addresses and coordinates
- Permit status tracking
- Technical notes (parking, load-in, sound)
- Backup location support

### Shooting Schedule
- Calendar-based schedule view
- Stripeboard scheduling with drag-and-drop
- Shooting day creation with multi-unit support
- Assign scenes to shooting days
- Cast call times per shooting day
- Weather and special notes

### Call Sheets
- Auto-generated from shooting days
- Department-specific call times
- Safety and logistics information
- PDF export

### Finance & Budgeting
- Budget creation with templates
- Hierarchical budget categories
- Line items with quantities and rates
- Transaction/expense tracking
- Budget vs. actual reporting
- Receipt parsing

### Team & Permissions
- Organization and project-level roles
- Role-based access control (RBAC)
- Permission matrix for all features
- Team invitation system

### Billing & Subscriptions
- Stripe subscription integration
- Free, Pro, and Studio plans
- Usage limits enforcement
- Invoice history and management

### Smart Features

Wrapshoot includes intelligent features powered by LLMs to streamline production workflows:

**Smart Script Breakdown**
- Automatic scene extraction from uploaded scripts
- Intelligent parsing of scene headers, action, and dialogue
- Script chunking for efficient processing of full-length screenplays
- Progress tracking with real-time status updates

**Smart Element Recognition**
- Automatic detection of props, wardrobe, vehicles, and special equipment
- Character recognition and cast suggestions
- Element categorization (PROP, WARDROBE, VEHICLE, MAKEUP, VFX, SFX, ANIMAL, GREENERY)
- Smart element suggestions based on scene content

**Smart Synopsis Generation**
- Automatic scene synopsis creation from script content
- Concise, production-focused summaries
- Batch processing for entire scripts

**Smart Time Estimation**
- Intelligent shooting time estimates based on scene complexity
- Factors in dialogue, action, and technical requirements
- Helps with schedule planning and day-out-of-days

**Smart Script Comparison**
- Detect changes between script revisions
- Highlight added, removed, and modified scenes
- Track script evolution throughout production

**Agent-Based Processing**
- Multi-step pipeline for complex analysis tasks
- Background job processing with progress tracking
- Automatic retry handling for reliability
- Real-time status updates via Supabase Realtime

### Sharing & Collaboration
- Share projects with team members
- Email invitations to collaborators
- Real-time updates across users

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

## Project Structure

```
ProdAI/
├── apps/
│   └── web/                          # Next.js 16 application
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
│       │       ├── ai/               # Smart feature endpoints
│       │       │   ├── estimate-time/
│       │       │   ├── recognize-elements/
│       │       │   ├── script-diff/
│       │       │   ├── suggestions/
│       │       │   └── synopsis/
│       │       ├── agents/           # Agent job management
│       │       │   ├── start/
│       │       │   ├── status/
│       │       │   └── cancel/
│       │       ├── billing/          # Stripe checkout/portal
│       │       ├── scripts/          # Script processing
│       │       ├── receipts/         # Receipt parsing
│       │       ├── share/            # Sharing functionality
│       │       └── webhooks/stripe/  # Stripe webhook handler
│       ├── components/
│       │   ├── ui/                   # shadcn/ui primitives
│       │   ├── agents/               # Agent progress UI
│       │   ├── forms/                # Entity forms
│       │   ├── layout/               # Sidebar, header, navigation
│       │   ├── projects/             # Project-specific components
│       │   ├── scenes/               # Scene management UI
│       │   ├── calendar/             # Calendar views
│       │   ├── feedback/             # User feedback components
│       │   ├── share/                # Sharing components
│       │   └── providers/            # React context providers
│       ├── lib/
│       │   ├── agents/               # Smart feature agents
│       │   │   ├── orchestrator/     # Job management & progress
│       │   │   ├── script-analysis/  # Script processing steps
│       │   │   └── utils/            # JSON parsing, retry handling
│       │   ├── supabase/             # Supabase client setup
│       │   ├── actions/              # Server Actions (all CRUD)
│       │   ├── permissions/          # RBAC authorization
│       │   ├── billing/              # Billing utilities
│       │   ├── stores/               # Zustand stores
│       │   ├── hooks/                # Custom React hooks
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
| `AgentJob` | Background job for smart feature processing |

### Authorization Entities

| Entity | Description |
|--------|-------------|
| `OrganizationMember` | User membership in an org (OWNER, ADMIN, MEMBER) |
| `ProjectMember` | User role on a project (ADMIN → VIEWER) |
| `ProjectInvite` | Pending invitation with token |
| `Subscription` | Stripe subscription for billing |
| `PlanTier` | Subscription plan configuration |

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

## Smart Features Architecture

### Agent Pipeline

Smart features use a multi-step agent pipeline for complex processing:

```
Script Upload → Chunking → Scene Extraction → Element Recognition → Synopsis Generation → Time Estimation
```

Each step runs as part of a managed job with:
- Progress tracking (0-100%)
- Real-time status updates
- Automatic retry on failure
- Cancellation support

### Available Agents

| Agent | Purpose |
|-------|---------|
| `ChunkingStep` | Split scripts into processable chunks |
| `SceneExtractor` | Extract scenes from script text |
| `ElementExtractor` | Identify props, wardrobe, vehicles, etc. |
| `SynopsisGenerator` | Generate scene synopses |
| `TimeEstimator` | Estimate shooting duration |
| `CastLinker` | Link characters to cast members |
| `SceneCreator` | Create scenes in database |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agents/start` | POST | Start a new agent job |
| `/api/agents/status` | GET | Get job status and progress |
| `/api/agents/cancel` | POST | Cancel a running job |
| `/api/ai/synopsis` | POST | Generate scene synopsis |
| `/api/ai/estimate-time` | POST | Estimate shooting time |
| `/api/ai/recognize-elements` | POST | Detect elements in text |
| `/api/ai/suggestions/elements` | POST | Get element suggestions |
| `/api/ai/script-diff` | POST | Compare script versions |

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

# Smart Features
FIREWORKS_API_KEY=fw_...
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

# Testing
npm run test             # Run all tests
npm run test:unit        # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e         # Run end-to-end tests
```

---

## Documentation

- [docs/README.md](./docs/README.md) - Documentation overview
- [docs/codebase.md](./docs/codebase.md) - Codebase guide
- [docs/architecture.md](./docs/architecture.md) - Architecture details
- [docs/setup.md](./docs/setup.md) - Setup instructions
- [docs/api.md](./docs/api.md) - API reference
- [docs/usage.md](./docs/usage.md) - Usage guide

---

## License

MIT
