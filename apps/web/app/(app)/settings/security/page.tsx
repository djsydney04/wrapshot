"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Users,
  Building2,
  ChevronRight,
  Key,
  Smartphone,
  Monitor,
  MapPin,
  Clock,
  AlertTriangle,
  Check,
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

const sessions = [
  {
    id: "1",
    device: "MacBook Pro",
    browser: "Chrome 121",
    location: "Los Angeles, CA",
    lastActive: "Active now",
    current: true,
  },
  {
    id: "2",
    device: "iPhone 15 Pro",
    browser: "Safari",
    location: "Los Angeles, CA",
    lastActive: "2 hours ago",
    current: false,
  },
  {
    id: "3",
    device: "Windows PC",
    browser: "Firefox 122",
    location: "New York, NY",
    lastActive: "3 days ago",
    current: false,
  },
];

export default function SecuritySettingsPage() {
  const pathname = usePathname();
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 gradient-mesh opacity-50 pointer-events-none" />
      <div className="grain-page" />

      <Header breadcrumbs={[{ label: "Settings" }, { label: "Security" }]} />

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
                <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your password and account security
                </p>
              </div>

              {/* Password */}
              <div className="card-premium">
                <div className="p-6 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="font-semibold">Password</h2>
                      <p className="text-sm text-muted-foreground">Update your password</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="Enter current password"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Enter new password"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end px-6 py-5 bg-muted/30 border-t border-border/50 rounded-b-2xl">
                  <Button className="rounded-xl px-6">Update Password</Button>
                </div>
              </div>

              {/* Two-Factor Authentication */}
              <div className="card-premium p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                      twoFactorEnabled ? "bg-accent-emerald-soft" : "bg-muted"
                    )}>
                      <Smartphone className={cn(
                        "h-6 w-6",
                        twoFactorEnabled ? "text-accent-emerald" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">Two-Factor Authentication</h2>
                        {twoFactorEnabled && (
                          <Badge variant="secondary" className="bg-accent-emerald-soft text-accent-emerald border-0">
                            <Check className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {twoFactorEnabled
                          ? "Your account is protected with 2FA"
                          : "Add an extra layer of security"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={twoFactorEnabled ? "outline" : "default"}
                    className="rounded-xl"
                    onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  >
                    {twoFactorEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="card-premium">
                <div className="p-6 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="font-semibold">Active Sessions</h2>
                      <p className="text-sm text-muted-foreground">Manage your logged in devices</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl">
                    Sign Out All
                  </Button>
                </div>

                <div className="divide-y divide-border/50">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-4 p-5">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        session.current ? "bg-accent-blue-soft" : "bg-muted"
                      )}>
                        <Monitor className={cn(
                          "h-5 w-5",
                          session.current ? "text-accent-blue" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{session.device}</p>
                          {session.current && (
                            <Badge variant="secondary" className="bg-accent-blue-soft text-accent-blue border-0 text-xs">
                              This device
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          <span>{session.browser}</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.lastActive}
                          </span>
                        </div>
                      </div>
                      {!session.current && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground">
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-2xl border-2 border-destructive/20 bg-destructive/5 overflow-hidden">
                <div className="p-6 border-b border-destructive/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <h2 className="font-semibold text-destructive">Danger Zone</h2>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Delete Account</p>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete your account and all associated data
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" className="rounded-xl">
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
