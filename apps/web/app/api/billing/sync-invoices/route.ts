import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's subscription
    const { data: subscription } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", user.id)
      .single();

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ invoiceCount: 0 });
    }

    const stripe = getStripe();

    // Fetch all paid invoices for this customer from Stripe
    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      status: "paid",
      limit: 100,
    });

    const invoiceCount = invoices.data.length;

    // Update the subscription with the accurate count from Stripe
    await supabase
      .from("Subscription")
      .update({
        invoiceCount,
        updatedAt: new Date().toISOString(),
      })
      .eq("userId", user.id);

    return NextResponse.json({ invoiceCount });
  } catch (error) {
    console.error("Error syncing invoices:", error);
    return NextResponse.json(
      { error: "Failed to sync invoices" },
      { status: 500 }
    );
  }
}
