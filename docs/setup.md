# SetSync Setup Guide

## Prerequisites

- Node.js 18+
- npm 10.x (included with Node.js 18+)
- A Supabase account ([supabase.com](https://supabase.com))

## Step-by-Step Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: SetSync Dev (or your preference)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project" and wait ~2 minutes for setup

### 2. Get Supabase Credentials

Once your project is ready:

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** in the left menu
3. Copy the following values:

```
Project URL: https://xxxxx.supabase.co
anon/public key: eyJxxx...
```

4. Go to **Database** in settings
5. Copy the **Connection string** (Transaction pooler recommended)
   - Click "Connection pooler" tab
   - Mode: Transaction
   - Copy the URI (it starts with `postgres://...`)
6. Also copy the **Direct connection** string
   - Click "Direct connection" tab
   - Copy the URI

### 3. Configure Environment Variables

In the project root directory:

1. Open `.env` file
2. Fill in your Supabase credentials:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJxxx..."
SUPABASE_SERVICE_ROLE_KEY="eyJxxx..."  # Get from API settings

# Email (optional, required for invite emails)
RESEND_API_KEY="re_xxx..."
RESEND_FROM_EMAIL="wrapshoot <noreply@yourdomain.com>"

# Database
DATABASE_URL="postgres://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
```

**Important**: Replace `password` in the URLs with your actual database password!

### 4. Install Dependencies

```bash
npm install
```

This will install all packages for the monorepo.

### 5. Generate Prisma Client

```bash
npm run db:generate
```

### 6. Push Database Schema to Supabase

```bash
npm run db:push
```

This creates all the tables in your Supabase database.

### 7. Seed the Database with Sample Data

```bash
npm run db:seed
```

This creates:
- 1 Organization (Acme Productions)
- 1 Project (Demo Feature Film)
- 5 Cast members
- 3 Locations
- 5 Scenes
- 3 Shooting days
- 1 Call sheet

### 8. Start the Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### 9. Create Your First Account

1. Go to http://localhost:3000
2. Click "Sign up"
3. Enter email and password (min 8 characters)
4. Check your email for confirmation link
5. Click the link to verify
6. Sign in with your credentials

## Troubleshooting

### Database Connection Issues

**Error**: "Can't reach database server"
- Check that your `DATABASE_URL` and `DIRECT_URL` are correct
- Make sure you replaced `password` with your actual database password
- Verify your Supabase project is active (not paused)

### Prisma Generate Fails

**Error**: "Prisma schema not found"
- Make sure you're in the project root directory
- Run `npm run db:generate` from the project root directory

### Email Confirmation Not Arriving

- Check your spam folder
- In Supabase dashboard, go to Authentication → Providers
- Temporarily disable "Confirm email" for testing:
  - Settings → Authentication → Email Auth → Toggle off "Confirm email"

### Port 3000 Already in Use

```bash
# Kill the process on port 3000
lsof -ti:3000 | xargs kill -9

# Or run on a different port
npm run dev -- -p 3001
```

## Next Steps

After setup, you can:

1. **View Prisma Studio**: `npm run db:studio`
   - Visual database editor at http://localhost:5555

2. **Explore Sample Data**: The seed created a full sample project

3. **Start Building**: Follow the implementation plan referenced in your internal planning docs

## Useful Commands

```bash
# Development
npm run dev             # Start dev server
npm run build           # Build for production
npm run lint            # Run linter

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes
npm run db:migrate      # Create migration
npm run db:seed         # Seed database
npm run db:studio       # Open Prisma Studio

# Clean install
rm -rf node_modules */node_modules */*/node_modules
npm install
```

## Project Structure

```
ProdAI/
├── apps/
│   └── web/                 # Next.js frontend
│       ├── app/            # App router pages
│       ├── components/     # React components
│       └── lib/            # Utilities
├── packages/
│   ├── database/           # Prisma schema
│   └── ui/                 # Shared components
└── turbo.json             # Monorepo config
```

## Support

If you encounter issues:

1. Check this setup guide
2. Review the [Supabase docs](https://supabase.com/docs)
3. Check the [Prisma docs](https://www.prisma.io/docs)
4. Review error messages carefully - they often contain the solution!
