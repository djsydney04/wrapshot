import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";
import type { PlanType } from "@/lib/stripe/plans";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const planId = session.metadata?.planId as PlanType;

  if (!organizationId || !planId) {
    console.error("Missing metadata in checkout session");
    return;
  }

  const stripeSubscriptionId = session.subscription as string;

  // Get the subscription from Stripe for full details
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  await prisma.subscription.upsert({
    where: { organizationId },
    update: {
      stripeSubscriptionId,
      stripePriceId: stripeSubscription.items.data[0]?.price.id,
      stripeCurrentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      status: "ACTIVE",
      plan: planId,
    },
    create: {
      organizationId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId,
      stripePriceId: stripeSubscription.items.data[0]?.price.id,
      stripeCurrentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      status: "ACTIVE",
      plan: planId,
    },
  });

  console.log(`Subscription activated for org ${organizationId}: ${planId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;

  if (!organizationId) {
    // Try to find by customer ID
    const existing = await prisma.subscription.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });
    if (!existing) {
      console.error("Could not find organization for subscription update");
      return;
    }
  }

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    canceled: "CANCELED",
    past_due: "PAST_DUE",
    unpaid: "UNPAID",
  };

  const status = statusMap[subscription.status] || "ACTIVE";
  const planId = (subscription.metadata?.planId as PlanType) || "PRO";

  await prisma.subscription.updateMany({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        { stripeCustomerId: subscription.customer as string },
      ],
    },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      status: status as "ACTIVE" | "TRIALING" | "CANCELED" | "PAST_DUE" | "UNPAID",
      plan: planId,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  console.log(`Subscription updated: ${subscription.id} -> ${status}`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: "CANCELED",
      plan: "FREE",
    },
  });

  console.log(`Subscription canceled: ${subscription.id}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  // Update the period end date
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      status: "ACTIVE",
    },
  });

  console.log(`Invoice paid: ${invoice.id}`);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: invoice.subscription as string },
    data: {
      status: "PAST_DUE",
    },
  });

  console.log(`Invoice payment failed: ${invoice.id}`);
}
