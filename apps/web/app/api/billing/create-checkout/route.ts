import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, PRICE_IDS } from "@/lib/stripe/client";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: "Missing planId" },
        { status: 400 }
      );
    }

    // Get or create Stripe price ID
    let priceId: string | undefined;
    if (planId === "PRO") {
      priceId = PRICE_IDS.PRO_MONTHLY;
    } else if (planId === "STUDIO") {
      priceId = PRICE_IDS.STUDIO_MONTHLY;
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    // Check if user already has a subscription with a Stripe customer
    const { data: subscription } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", user.id)
      .maybeSingle();

    const stripe = getStripe();
    let customerId = subscription?.stripeCustomerId;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
        name: user.email,
      });
      customerId = customer.id;

      // Save customer ID to subscription record (upsert to handle race conditions)
      await supabase
        .from("Subscription")
        .upsert({
          userId: user.id,
          stripeCustomerId: customerId,
          plan: "FREE",
          status: "ACTIVE",
        }, {
          onConflict: "userId",
        });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
