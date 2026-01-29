#!/usr/bin/env npx tsx
/**
 * Admin script to override a user's plan
 *
 * Usage:
 *   npx tsx scripts/admin-set-plan.ts <email> <plan>
 *
 * Examples:
 *   npx tsx scripts/admin-set-plan.ts user@example.com PRO
 *   npx tsx scripts/admin-set-plan.ts user@example.com STUDIO
 *   npx tsx scripts/admin-set-plan.ts user@example.com FREE
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing environment variables");
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nRun with: npx dotenv -e .env.local -- npx tsx scripts/admin-set-plan.ts <email> <plan>");
  process.exit(1);
}

const validPlans = ["FREE", "PRO", "STUDIO"] as const;
type Plan = (typeof validPlans)[number];

async function main() {
  const [email, plan] = process.argv.slice(2);

  if (!email || !plan) {
    console.log("Usage: npx tsx scripts/admin-set-plan.ts <email> <plan>");
    console.log("Plans: FREE, PRO, STUDIO");
    process.exit(1);
  }

  if (!validPlans.includes(plan as Plan)) {
    console.error(`Invalid plan: ${plan}`);
    console.error(`Valid plans: ${validPlans.join(", ")}`);
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log(`Setting plan for ${email} to ${plan}...`);

  const { data, error } = await supabase.rpc("admin_set_user_plan", {
    user_email: email,
    new_plan: plan,
    reason: `Manual override via CLI at ${new Date().toISOString()}`,
  });

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  if (!data.success) {
    console.error("Failed:", data.error);
    process.exit(1);
  }

  console.log("Success!");
  console.log(JSON.stringify(data, null, 2));
}

main();
