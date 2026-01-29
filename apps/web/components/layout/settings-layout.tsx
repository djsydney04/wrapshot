"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Users,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  { label: "Profile", href: "/settings", icon: User, description: "Your personal info" },
  { label: "Team", href: "/settings/team", icon: Users, description: "Manage members" },
  { label: "Notifications", href: "/settings/notifications", icon: Bell, description: "Alert preferences" },
  { label: "Billing", href: "/settings/billing", icon: CreditCard, description: "Plans & invoices" },
  { label: "Security", href: "/settings/security", icon: Shield, description: "Password & 2FA" },
];

interface SettingsLayoutProps {
  title: string;
  description: string;
  breadcrumbs?: { label: string }[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsLayout({
  title,
  description,
  breadcrumbs = [{ label: "Settings" }],
  actions,
  children,
}: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-background">
      <Header breadcrumbs={breadcrumbs} />

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
                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                        isActive
                          ? "bg-muted"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-foreground text-background"
                          : "text-muted-foreground group-hover:text-foreground"
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
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground/40 transition-transform",
                        isActive && "text-foreground"
                      )} />
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                  <p className="text-muted-foreground mt-1">{description}</p>
                </div>
                {actions}
              </div>

              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings card component for consistent styling
interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {children}
    </div>
  );
}

// Settings card header
interface SettingsCardHeaderProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}

export function SettingsCardHeader({ title, description, icon: Icon, action }: SettingsCardHeaderProps) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-border">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div>
          <h2 className="font-medium">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// Settings card body
interface SettingsCardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsCardBody({ children, className }: SettingsCardBodyProps) {
  return (
    <div className={cn("p-5", className)}>
      {children}
    </div>
  );
}

// Settings card footer
interface SettingsCardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsCardFooter({ children, className }: SettingsCardFooterProps) {
  return (
    <div className={cn("flex items-center justify-end gap-3 p-5 bg-muted/30 border-t border-border", className)}>
      {children}
    </div>
  );
}

// Danger zone card
interface DangerZoneProps {
  title: string;
  description: string;
  action: React.ReactNode;
}

export function DangerZone({ title, description, action }: DangerZoneProps) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden">
      <div className="flex items-center justify-between p-5">
        <div>
          <p className="font-medium text-destructive">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
