# Usage

## Local Development

```bash
npm install
npm run dev
```

App runs on `http://localhost:3000` by default.

## Database

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:studio
```

## Admin Scripts

Set a user's billing plan (requires env vars):

```bash
npx dotenv -e .env.local -- npx tsx scripts/admin-set-plan.ts <email> <plan>
```

Plans: `FREE`, `PRO`, `STUDIO`.

## Common Workflows

- **Create a project**: Sign up → create a project from the dashboard.
- **Manage scenes**: Projects → Scenes to add, edit, and schedule.
- **Billing**: Settings → Billing to upgrade/manage subscription.
- **Script breakdown**: Upload a script file and run the breakdown action.
- **Receipts**: Upload a receipt image for parsing.

## Troubleshooting Quick Hits

- If auth redirects loop, verify Supabase URL/keys in `.env.local`.
- If Prisma errors, rerun `npm run db:generate`.
- If Stripe checkout fails, confirm `NEXT_PUBLIC_APP_URL` and price IDs.
