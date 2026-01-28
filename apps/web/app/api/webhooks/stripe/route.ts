import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${errorMessage}`);
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
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

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;

async function handleCheckoutCompleted(supabase: SupabaseClientType, session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const organizationId = session.metadata?.organizationId;

  if (!organizationId) {
    console.error("No organizationId in checkout session metadata");
    return;
  }

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  // Upsert subscription record
  const { error } = await supabase
    .from("Subscription")
    .upsert({
      organizationId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      status: mapStripeStatus(subscription.status),
      plan,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }, {
      onConflict: "organizationId",
    });

  if (error) {
    console.error("Error upserting subscription:", error);
    throw error;
  }

  console.log(`Checkout completed for org ${organizationId}, plan: ${plan}`);
}

async function handleSubscriptionChange(supabase: SupabaseClientType, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  // Find subscription by customer ID
  const { data: existingSub } = await supabase
    .from("Subscription")
    .select("id, organizationId")
    .eq("stripeCustomerId", customerId)
    .single();

  if (!existingSub) {
    console.log(`No subscription found for customer ${customerId}`);
    return;
  }

  const { error } = await supabase
    .from("Subscription")
    .update({
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      status: mapStripeStatus(subscription.status),
      plan,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", existingSub.id);

  if (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }

  console.log(`Subscription updated for org ${existingSub.organizationId}, status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(supabase: SupabaseClientType, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { error } = await supabase
    .from("Subscription")
    .update({
      status: "CANCELED",
      plan: "FREE",
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date().toISOString(),
    })
    .eq("stripeCustomerId", customerId);

  if (error) {
    console.error("Error handling subscription deletion:", error);
    throw error;
  }

  console.log(`Subscription deleted for customer ${customerId}`);
}

async function handlePaymentSucceeded(supabase: SupabaseClientType, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Update subscription period end
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

    const { error } = await supabase
      .from("Subscription")
      .update({
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        status: "ACTIVE",
        updatedAt: new Date().toISOString(),
      })
      .eq("stripeCustomerId", customerId);

    if (error) {
      console.error("Error updating subscription after payment:", error);
    }
  }

  console.log(`Payment succeeded for customer ${customerId}`);
}

async function handlePaymentFailed(supabase: SupabaseClientType, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { error } = await supabase
    .from("Subscription")
    .update({
      status: "PAST_DUE",
      updatedAt: new Date().toISOString(),
    })
    .eq("stripeCustomerId", customerId);

  if (error) {
    console.error("Error updating subscription after failed payment:", error);
  }

  console.log(`Payment failed for customer ${customerId}`);
}

function getPlanFromPriceId(priceId: string | undefined): "FREE" | "PRO" | "STUDIO" {
  if (!priceId) return "FREE";

  const proPrices = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  ];
  const studioPrices = [
    process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID,
    process.env.STRIPE_STUDIO_YEARLY_PRICE_ID,
  ];

  if (proPrices.includes(priceId)) return "PRO";
  if (studioPrices.includes(priceId)) return "STUDIO";
  return "FREE";
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: "ACTIVE",
    canceled: "CANCELED",
    incomplete: "UNPAID",
    incomplete_expired: "CANCELED",
    past_due: "PAST_DUE",
    paused: "ACTIVE",
    trialing: "TRIALING",
    unpaid: "UNPAID",
  };
  return statusMap[status] || "ACTIVE";
}
