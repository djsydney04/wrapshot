"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  CreditCard,
  Download,
  Zap,
  Sparkles,
  Crown,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SettingsLayout,
  SettingsCard,
  SettingsCardHeader,
  SettingsCardBody,
} from "@/components/layout/settings-layout";
import { useSubscription } from "@/lib/hooks/use-permissions";
import { useAuth } from "@/components/providers/auth-provider";

const plans = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    description: "For individuals getting started",
    features: ["1 project", "3 team members", "Basic scheduling", "7-day history"],
    icon: Zap,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  {
    id: "PRO",
    name: "Pro",
    price: "$29",
    description: "For growing production teams",
    features: ["Unlimited projects", "25 team members", "Advanced scheduling", "Call sheet generation", "30-day history"],
    icon: Sparkles,
    color: "text-blue-600",
    bg: "bg-blue-50",
    popular: true,
  },
  {
    id: "STUDIO",
    name: "Studio",
    price: "$99",
    description: "For large productions",
    features: ["Everything in Pro", "Unlimited team members", "Priority support", "Custom integrations", "Unlimited history", "API access"],
    icon: Crown,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
];

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const subscription = useSubscription();
  const currentPlan = subscription?.plan ?? "FREE";

  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check for success/cancel from Stripe redirect
  React.useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      setMessage({ type: "success", text: "Your subscription has been updated!" });
      // Clear the URL params
      router.replace("/settings/billing");
    } else if (canceled === "true") {
      setMessage({ type: "error", text: "Checkout was canceled." });
      router.replace("/settings/billing");
    }
  }, [searchParams, router]);

  const handleUpgrade = async (planId: string) => {
    if (!user?.id) return;

    setLoadingPlan(planId);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error upgrading:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to start upgrade process",
      });
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!user?.id) return;

    setLoadingPortal(true);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/create-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create portal session");
      }

      // Redirect to Stripe customer portal
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to open billing portal",
      });
      setLoadingPortal(false);
    }
  };

  const getTrialDaysLeft = () => {
    if (subscription?.status !== "TRIALING" || !subscription?.stripeCurrentPeriodEnd) {
      return null;
    }
    const endDate = new Date(subscription.stripeCurrentPeriodEnd);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const trialDaysLeft = getTrialDaysLeft();

  return (
    <>
      {/* Status Message */}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg mb-4",
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Current Plan */}
      <SettingsCard>
        <SettingsCardBody>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                currentPlan === "STUDIO" ? "bg-amber-50" : currentPlan === "PRO" ? "bg-blue-50" : "bg-muted"
              )}>
                {currentPlan === "STUDIO" ? (
                  <Crown className="h-5 w-5 text-amber-600" />
                ) : currentPlan === "PRO" ? (
                  <Sparkles className="h-5 w-5 text-blue-600" />
                ) : (
                  <Zap className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    {plans.find(p => p.id === currentPlan)?.name ?? "Free"} Plan
                  </h3>
                  {subscription?.status === "TRIALING" && trialDaysLeft !== null && (
                    <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-0">
                      {trialDaysLeft} days left in trial
                    </Badge>
                  )}
                  {subscription?.cancelAtPeriodEnd && (
                    <Badge variant="secondary" className="bg-red-50 text-red-600 border-0">
                      Canceling
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentPlan === "FREE"
                    ? "Upgrade to unlock more features"
                    : `$${currentPlan === "PRO" ? "29" : "99"}/month`}
                </p>
              </div>
            </div>
            {subscription?.stripeSubscriptionId && (
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
              >
                {loadingPortal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Manage Subscription
              </Button>
            )}
          </div>
        </SettingsCardBody>
      </SettingsCard>

      {/* Plans */}
      <div>
        <h2 className="text-sm font-medium mb-3">Plans</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = plan.id === currentPlan;
            const isUpgrade =
              (currentPlan === "FREE" && (plan.id === "PRO" || plan.id === "STUDIO")) ||
              (currentPlan === "PRO" && plan.id === "STUDIO");
            const isDowngrade =
              (currentPlan === "STUDIO" && (plan.id === "PRO" || plan.id === "FREE")) ||
              (currentPlan === "PRO" && plan.id === "FREE");
            const isLoading = loadingPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative p-5 rounded-xl border-2 transition-all",
                  isCurrent
                    ? "border-foreground bg-muted/30"
                    : "border-border bg-card hover:border-muted-foreground/30"
                )}
              >
                {plan.popular && !isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-foreground text-background">
                      Popular
                    </span>
                  </div>
                )}

                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg mb-3", plan.bg)}>
                  <Icon className={cn("h-4 w-4", plan.color)} />
                </div>

                <h3 className="font-medium">{plan.name}</h3>
                <div className="mt-1 mb-2">
                  <span className="text-xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>

                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isCurrent ? "outline" : isUpgrade ? "default" : "outline"}
                  className="w-full"
                  disabled={isCurrent || isDowngrade || isLoading}
                  onClick={() => isUpgrade && handleUpgrade(plan.id)}
                >
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isCurrent
                    ? "Current Plan"
                    : isDowngrade
                    ? "Manage in Portal"
                    : "Upgrade"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Method - Only show if they have a subscription */}
      {subscription?.stripeSubscriptionId && (
        <SettingsCard>
          <SettingsCardHeader
            title="Payment Method"
            description="Manage your payment details in the billing portal"
          />
          <SettingsCardBody>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-card border border-border">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Payment on file</p>
                  <p className="text-xs text-muted-foreground">
                    Manage in Stripe billing portal
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
              >
                {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </div>
          </SettingsCardBody>
        </SettingsCard>
      )}

      {/* Billing History - Only show if they have a subscription */}
      {subscription?.stripeSubscriptionId && (
        <SettingsCard>
          <SettingsCardHeader
            title="Billing History"
            description="View invoices in the billing portal"
          />
          <SettingsCardBody>
            <div className="text-center py-6">
              <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                View and download invoices in the Stripe billing portal
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
              >
                {loadingPortal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Download className="h-4 w-4 mr-2" />
                View Invoices
              </Button>
            </div>
          </SettingsCardBody>
        </SettingsCard>
      )}
    </>
  );
}

function BillingWrapper() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="animate-pulse bg-muted h-48 rounded-xl" />;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Please sign in to access billing settings.</p>
      </div>
    );
  }

  return <BillingContent />;
}

export default function BillingSettingsPage() {
  return (
    <SettingsLayout
      title="Billing"
      description="Manage your subscription and payment methods"
      breadcrumbs={[{ label: "Settings" }, { label: "Billing" }]}
    >
      <React.Suspense fallback={<div className="animate-pulse bg-muted h-48 rounded-xl" />}>
        <BillingWrapper />
      </React.Suspense>
    </SettingsLayout>
  );
}
