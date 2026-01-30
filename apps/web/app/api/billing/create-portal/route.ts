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

    // Get the user's Stripe customer ID
    const { data: subscription } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", user.id)
      .maybeSingle();

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please upgrade first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
