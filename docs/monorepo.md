# Monorepo Structure

This repository uses npm workspaces + Turborepo to run `web`, `mobile`, and
shared packages from a single root.

## Workspace Map

- `apps/web`: Next.js web app
- `apps/mobile`: Expo React Native app
- `packages/database`: Prisma schema/client package
- `packages/typescript-config`: shared TypeScript base configs

## Root Commands

```bash
npm run dev:web
npm run dev:mobile
npm run build:web
npm run build:mobile
npm run lint:web
npm run lint:mobile
npm run typecheck:web
npm run typecheck:mobile
```

## CI Boundaries

- `.github/workflows/web-ci.yml` runs on `apps/web/**` + shared dependency
  changes.
- `.github/workflows/mobile-ci.yml` runs on `apps/mobile/**` + shared
  dependency changes.

This keeps CI feedback targeted while still revalidating shared package
updates against both apps.
