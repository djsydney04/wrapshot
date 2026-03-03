# Mobile App (`apps/mobile`)

Expo React Native app for ProdAI, focused on day-of-shoot execution.

## Current Scope

- Supabase email/password auth
- Project switching (project-member scoped)
- Today-first mobile shell with tabs:
  - Today
  - Schedule
  - Call Sheets
  - People
  - More
- Real data reads from Supabase (RLS enforced)
- Quick updates for day status/notes, call sheet notes, cast calls, and department/crew calls
- Realtime refresh via Supabase `postgres_changes`

## Required Env Vars

Use either Expo-style or existing web-style names:

- `EXPO_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Commands

```bash
npm run dev --workspace=mobile
npm run ios --workspace=mobile
npm run android --workspace=mobile
npm run web --workspace=mobile
npm run lint --workspace=mobile
npm run typecheck --workspace=mobile
npm run build --workspace=mobile
```

## Notes

- Keep shared business logic in `packages/*` when feasible.
- Mobile is intentionally today-first, but retains web-familiar section naming.
