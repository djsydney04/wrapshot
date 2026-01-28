"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Users,
  Building2,
  Check,
  ChevronRight,
  Download,
  Zap,
  Sparkles,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  { label: "Profile", href: "/settings", icon: User, description: "Your personal info" },
  { label: "Organization", href: "/settings/organization", icon: Building2, description: "Company settings" },
  { label: "Team", href: "/settings/team", icon: Users, description: "Manage members" },
  { label: "Notifications", href: "/settings/notifications", icon: Bell, description: "Alert preferences" },
  { label: "Billing", href: "/settings/billing", icon: CreditCard, description: "Plans & invoices" },
  { label: "Security", href: "/settings/security", icon: Shield, description: "Password & 2FA" },
];

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "For individuals getting started",
    features: ["1 project", "3 team members", "Basic scheduling", "7-day history"],
    icon: Zap,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    description: "For growing production teams",
    features: ["Unlimited projects", "25 team members", "Advanced scheduling", "Call sheet generation", "30-day history"],
    icon: Sparkles,
    color: "text-accent-blue",
    bg: "bg-accent-blue-soft",
    popular: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: "$99",
    description: "For large productions",
    features: ["Everything in Pro", "Unlimited team members", "Priority support", "Custom integrations", "Unlimited history", "API access"],
    icon: Crown,
    color: "text-accent-amber",
    bg: "bg-accent-amber-soft",
  },
];

const invoices = [
  { id: "INV-001", date: "Jan 1, 2025", amount: "$29.00", status: "Paid" },
  { id: "INV-002", date: "Dec 1, 2024", amount: "$29.00", status: "Paid" },
  { id: "INV-003", date: "Nov 1, 2024", amount: "$29.00", status: "Paid" },
];

export default function BillingSettingsPage() {
  const pathname = usePathname();
  const currentPlan = "pro";

  return (
    <div className="flex h-full flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 gradient-mesh opacity-50 pointer-events-none" />
      <div className="grain-page" />

      <Header breadcrumbs={[{ label: "Settings" }, { label: "Billing" }]} />

      <div className="flex-1 overflow-auto relative">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex gap-12">
            {/* Sidebar Nav */}
            <nav className="w-56 shrink-0">
              <div className="sticky top-6 space-y-1">
                {settingsNav.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200",
                        isActive
                          ? "bg-accent-blue-soft shadow-soft"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                        isActive
                          ? "bg-accent-blue text-white"
                          : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground/50 transition-transform",
                        isActive && "text-accent-blue"
                      )} />
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your subscription and payment methods
                </p>
              </div>

              {/* Current Plan */}
              <div className="card-premium p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-blue-soft">
                      <Sparkles className="h-6 w-6 text-accent-blue" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Pro Plan</h3>
                        <Badge variant="secondary" className="bg-accent-blue-soft text-accent-blue border-0">
                          Current
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">$29/month · Renews Feb 1, 2025</p>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-xl">Manage Subscription</Button>
                </div>
              </div>

              {/* Plans */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Plans</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {plans.map((plan) => {
                    const Icon = plan.icon;
                    const isCurrent = plan.id === currentPlan;
                    return (
                      <div
                        key={plan.id}
                        className={cn(
                          "relative p-6 rounded-2xl border-2 transition-all",
                          isCurrent
                            ? "border-accent-blue bg-accent-blue-soft/30"
                            : "border-border/50 bg-card hover:border-muted-foreground/30"
                        )}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent-blue text-white">
                              Most Popular
                            </span>
                          </div>
                        )}

                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl mb-4", plan.bg)}>
                          <Icon className={cn("h-5 w-5", plan.color)} />
                        </div>

                        <h3 className="font-semibold">{plan.name}</h3>
                        <div className="mt-1 mb-2">
                          <span className="text-2xl font-bold">{plan.price}</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                        <ul className="space-y-2 mb-6">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-accent-emerald" />
                              {feature}
                            </li>
                          ))}
                        </ul>

                        <Button
                          variant={isCurrent ? "outline" : "default"}
                          className="w-full rounded-xl"
                          disabled={isCurrent}
                        >
                          {isCurrent ? "Current Plan" : "Upgrade"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method */}
              <div className="card-premium">
                <div className="p-6 border-b border-border/50">
                  <h2 className="font-semibold">Payment Method</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Manage your payment details</p>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card border border-border">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">•••• •••• •••• 4242</p>
                        <p className="text-sm text-muted-foreground">Expires 12/25</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">Update</Button>
                  </div>
                </div>
              </div>

              {/* Billing History */}
              <div className="card-premium">
                <div className="p-6 border-b border-border/50">
                  <h2 className="font-semibold">Billing History</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Download past invoices</p>
                </div>
                <div className="divide-y divide-border/50">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{invoice.id}</p>
                          <p className="text-sm text-muted-foreground">{invoice.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{invoice.amount}</span>
                        <Badge variant="secondary" className="bg-accent-emerald-soft text-accent-emerald border-0">
                          {invoice.status}
                        </Badge>
                        <Button variant="ghost" size="icon-sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
