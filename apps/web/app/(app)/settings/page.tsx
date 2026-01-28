"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Users,
  Building2,
  Camera,
  Check,
  ChevronRight,
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

export default function SettingsPage() {
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

      <Header breadcrumbs={[{ label: "Settings" }]} />

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
                <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your personal information and preferences
                </p>
              </div>

              {/* Avatar Section */}
              <div className="card-premium p-8">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-accent-blue-soft to-accent-purple-soft flex items-center justify-center overflow-hidden">
                      <Avatar size="lg" alt="User" className="h-20 w-20" />
                    </div>
                    <button className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-6 w-6 text-white" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-medium">Profile Photo</h3>
                    <p className="text-sm text-muted-foreground">
                      JPG, PNG or GIF. Max 5MB.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm">Upload</Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">Remove</Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="card-premium">
                <div className="p-8 space-y-6">
                  {/* Name Fields */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        defaultValue=""
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        defaultValue=""
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      defaultValue=""
                      className="h-11 rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the email used for notifications and sign-in
                    </p>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      defaultValue=""
                      className="h-11 rounded-xl"
                    />
                  </div>

                  {/* Job Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium">Job Title</Label>
                    <Input
                      id="title"
                      placeholder="Production Coordinator"
                      defaultValue=""
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="divider" />

                {/* Timezone */}
                <div className="p-8">
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-sm font-medium">Timezone</Label>
                    <select
                      id="timezone"
                      className="flex h-11 w-full rounded-xl border border-input bg-transparent px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue="America/Los_Angeles"
                    >
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                    </select>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-8 py-5 bg-muted/30 border-t border-border/50">
                  <Button variant="ghost">Cancel</Button>
                  <Button onClick={handleSave} className="gap-2 rounded-xl px-6">
                    {saved && <Check className="h-4 w-4" />}
                    {saved ? "Saved" : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
