import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { PLANS, type PlanType } from "@/lib/stripe/plans";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // Verify user has access to this organization
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No permission to manage billing" },
        { status: 403 }
      );
    }

    // Get the plan configuration
    const plan = PLANS[planId as PlanType];
    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get or create the subscription record
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    let customerId: string;

    if (subscription?.stripeCustomerId) {
      customerId = subscription.stripeCustomerId;
    } else {
      // Get organization details for customer creation
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          organizationId,
          organizationName: organization?.name || "Unknown",
        },
      });

      customerId = customer.id;

      // Create or update subscription record
      if (subscription) {
        subscription = await prisma.subscription.update({
          where: { organizationId },
          data: { stripeCustomerId: customerId },
        });
      } else {
        subscription = await prisma.subscription.create({
          data: {
            organizationId,
            stripeCustomerId: customerId,
            status: "TRIALING",
            plan: "FREE",
          },
        });
      }
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
      metadata: {
        organizationId,
        planId,
      },
      subscription_data: {
        metadata: {
          organizationId,
          planId,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
