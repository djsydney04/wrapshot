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

    const { planId, organizationId } = await request.json();

    if (!planId || !organizationId) {
      return NextResponse.json(
        { error: "Missing planId or organizationId" },
        { status: 400 }
      );
    }

    // Verify user is owner/admin of the organization
    const { data: membership } = await supabase
      .from("OrganizationMember")
      .select("role")
      .eq("organizationId", organizationId)
      .eq("userId", user.id)
      .single();

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { error: "You don't have permission to manage billing" },
        { status: 403 }
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

    // Check if organization already has a Stripe customer
    const { data: subscription } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("organizationId", organizationId)
      .single();

    const stripe = getStripe();
    let customerId = subscription?.stripeCustomerId;

    // Create customer if doesn't exist
    if (!customerId) {
      const { data: org } = await supabase
        .from("Organization")
        .select("name")
        .eq("id", organizationId)
        .single();

      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          organizationId,
          userId: user.id,
        },
        name: org?.name,
      });
      customerId = customer.id;

      // Save customer ID to subscription record
      await supabase
        .from("Subscription")
        .upsert({
          organizationId,
          stripeCustomerId: customerId,
          plan: "FREE",
          status: "TRIALING",
        }, {
          onConflict: "organizationId",
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
        organizationId,
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
