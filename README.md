# SetSync - Film Production Scheduling Platform

AI-powered movie production scheduling software built with Next.js, Supabase, and Prisma.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **UI**: shadcn/ui, Radix UI, Lucide Icons
- **Backend**: Next.js Server Actions, Prisma ORM
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Forms**: React Hook Form + Zod
- **Drag & Drop**: @dnd-kit
- **Data Fetching**: TanStack Query
- **State**: Zustand (client state)

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

### Prerequisites

- Node.js 18+
- npm (comes with Node.js)
- A Supabase account ([supabase.com](https://supabase.com))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables (see SETUP.md)
#    Add your Supabase credentials to .env

# 3. Push database schema to Supabase
npm run db:push

# 4. Generate Prisma client
npm run db:generate

# 5. Seed sample data
npm run db:seed

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up for an account.

## Project Structure

```
ProdAI/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/
│       │   ├── login/          # Login page
│       │   ├── signup/         # Signup page
│       │   ├── dashboard/      # Main dashboard
│       │   └── auth/           # Auth callbacks
│       ├── components/         # React components
│       ├── lib/                # Utilities and Supabase client
│       └── middleware.ts       # Auth middleware
├── packages/
│   ├── database/               # Prisma schema + client
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── seed.ts         # Sample data
│   │   └── src/index.ts        # Prisma client export
│   └── typescript-config/      # Shared TypeScript configs
└── package.json                # Workspace configuration
```

## MVP Features (Phase 1)

✅ **Foundation Complete:**
- ✅ Monorepo setup with npm workspaces
- ✅ Full database schema (Organizations, Projects, Scenes, Cast, Locations, etc.)
- ✅ Supabase authentication (signup, login, auth middleware)
- ✅ Sample data seeding
- ✅ Basic dashboard UI

🚧 **In Progress:**
- Projects CRUD
- Scene breakdown interface
- Cast & location management
- Stripboard with drag-and-drop
- Calendar views (day/week/month)
- Call sheet generation & PDF export

❌ **Phase 2:**
- AI script breakdown (Claude API)
- AI schedule optimization
- Production reports
- Mobile app
- External integrations (Google Calendar, Slack)

## Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint             # Run linter

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate       # Create migration
npm run db:seed          # Seed database with sample data
npm run db:studio        # Open Prisma Studio (http://localhost:5555)
```

## Sample Data

After running `npm run db:seed`, you'll have:

- **1 Organization**: Acme Productions
- **1 Project**: Demo Feature Film (Pre-Production)
- **5 Cast Members**: Including Emma Stone and Ryan Gosling
- **3 Locations**: Coffee Shop, Park, Warehouse
- **5 Scenes**: Fully populated with cast and elements
- **3 Shooting Days**: Scheduled with scenes
- **1 Call Sheet**: Ready to view/edit

## Next Steps

1. **Explore the database**: Run `npm run db:studio` to browse data
2. **Build the UI**: Start with the projects list page
3. **Follow the plan**: See `/Users/djsydney/.claude/plans/glowing-sparking-stardust.md`

## Supabase Configuration

### Authentication

- Email/password authentication is enabled by default
- Users must verify their email (check spam folder during dev)
- To disable email verification temporarily:
  - Go to Supabase Dashboard → Authentication → Providers
  - Under Email, toggle off "Confirm email"

### Row Level Security (Future)

RLS policies will be added to:
- Restrict users to their organizations
- Enforce project-level permissions
- Protect sensitive data (rates, contact info)

### File Storage (Future)

Create a `scripts` bucket in Supabase for:
- Script PDFs
- Call sheet exports
- Attachments

## Architecture Decisions

### Why Supabase over Clerk?

- **All-in-one**: Auth + Database + Storage in one platform
- **Cost**: More generous free tier
- **Control**: Direct database access with Prisma
- **Row Level Security**: Native PostgreSQL RLS support
- **Open source**: Can self-host if needed

### Why npm workspaces instead of Turborepo?

- Simpler setup for MVP
- Fewer dependencies
- Native to npm (no additional tools required)
- Can migrate to Turborepo later if needed

## Troubleshooting

See [SETUP.md](./SETUP.md) for detailed troubleshooting steps.

Common issues:
- **Database connection errors**: Check DATABASE_URL and DIRECT_URL in .env
- **Prisma client not found**: Run `npm run db:generate`
- **Email not arriving**: Check spam or disable email confirmation in Supabase
- **Port 3000 in use**: Kill process or use `-p 3001` flag

## License

MIT
