"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Users,
  Building2,
  Check,
  ChevronRight,
  Upload,
  AlertTriangle,
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

export default function OrganizationSettingsPage() {
  const pathname = usePathname();
  const [saved, setSaved] = React.useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 gradient-mesh opacity-50 pointer-events-none" />
      <div className="grain-page" />

      <Header breadcrumbs={[{ label: "Settings" }, { label: "Organization" }]} />

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
                <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your organization settings and branding
                </p>
              </div>

              {/* Logo Section */}
              <div className="card-premium p-8">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-accent-purple-soft to-accent-blue-soft flex items-center justify-center border-2 border-dashed border-border">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <button className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="h-5 w-5 text-white" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-medium">Organization Logo</h3>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG up to 2MB. Recommended 256x256px.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Upload
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">Remove</Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Organization Details */}
              <div className="card-premium">
                <div className="p-8 space-y-6">
                  {/* Organization Name */}
                  <div className="space-y-2">
                    <Label htmlFor="orgName" className="text-sm font-medium">Organization Name</Label>
                    <Input
                      id="orgName"
                      placeholder="Acme Productions"
                      defaultValue=""
                      className="h-11 rounded-xl"
                    />
                  </div>

                  {/* Slug */}
                  <div className="space-y-2">
                    <Label htmlFor="orgSlug" className="text-sm font-medium">URL Slug</Label>
                    <div className="flex items-center gap-0">
                      <span className="flex h-11 items-center px-4 text-sm text-muted-foreground bg-muted rounded-l-xl border border-r-0 border-input">
                        setsync.app/
                      </span>
                      <Input
                        id="orgSlug"
                        placeholder="acme-productions"
                        defaultValue=""
                        className="h-11 rounded-l-none rounded-r-xl"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for your organization&apos;s unique URL
                    </p>
                  </div>
                </div>

                <div className="divider" />

                {/* Contact Info */}
                <div className="p-8 space-y-6">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Contact Information</h3>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="orgEmail" className="text-sm font-medium">Email</Label>
                      <Input
                        id="orgEmail"
                        type="email"
                        placeholder="contact@acmeproductions.com"
                        defaultValue=""
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orgPhone" className="text-sm font-medium">Phone</Label>
                      <Input
                        id="orgPhone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        defaultValue=""
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="orgAddress" className="text-sm font-medium">Address</Label>
                    <Input
                      id="orgAddress"
                      placeholder="123 Production Way, Los Angeles, CA"
                      defaultValue=""
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-8 py-5 bg-muted/30 border-t border-border/50 rounded-b-2xl">
                  <div className="text-sm text-muted-foreground">
                    Organization ID: <code className="text-xs bg-muted px-2 py-1 rounded-lg">org_abc123</code>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost">Cancel</Button>
                    <Button onClick={handleSave} className="gap-2 rounded-xl px-6">
                      {saved && <Check className="h-4 w-4" />}
                      {saved ? "Saved" : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-2xl border-2 border-destructive/20 bg-destructive/5 overflow-hidden">
                <div className="p-6 border-b border-destructive/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-destructive">Danger Zone</h2>
                      <p className="text-sm text-muted-foreground">Irreversible and destructive actions</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Delete Organization</p>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete your organization and all its data
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" className="rounded-xl">
                      Delete Organization
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
