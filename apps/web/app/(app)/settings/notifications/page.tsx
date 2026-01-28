"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Users,
  Building2,
  Check,
  ChevronRight,
  Mail,
  Smartphone,
  Clapperboard,
  Calendar,
  AtSign,
  UserPlus,
  Clock,
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

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  email: boolean;
  push: boolean;
  sms: boolean;
}

export default function NotificationSettingsPage() {
  const pathname = usePathname();
  const [saved, setSaved] = React.useState(false);
  const [settings, setSettings] = React.useState<NotificationSetting[]>([
    {
      id: "callsheets",
      title: "Call Sheets",
      description: "When a new call sheet is published",
      icon: Clapperboard,
      email: true,
      push: true,
      sms: false,
    },
    {
      id: "schedule",
      title: "Schedule Changes",
      description: "When shooting days are added or modified",
      icon: Calendar,
      email: true,
      push: true,
      sms: false,
    },
    {
      id: "mentions",
      title: "Mentions",
      description: "When someone mentions you in a comment",
      icon: AtSign,
      email: true,
      push: true,
      sms: false,
    },
    {
      id: "assignments",
      title: "Assignments",
      description: "When you're assigned to a scene or day",
      icon: UserPlus,
      email: true,
      push: true,
      sms: false,
    },
    {
      id: "reminders",
      title: "Reminders",
      description: "Daily call time reminders",
      icon: Clock,
      email: false,
      push: true,
      sms: true,
    },
  ]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSetting = (id: string, channel: "email" | "push" | "sms") => {
    setSettings((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, [channel]: !s[channel] } : s
      )
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 gradient-mesh opacity-50 pointer-events-none" />
      <div className="grain-page" />

      <Header breadcrumbs={[{ label: "Settings" }, { label: "Notifications" }]} />

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
                <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
                <p className="text-muted-foreground mt-1">
                  Choose how and when you want to be notified
                </p>
              </div>

              {/* Notification Settings */}
              <div className="card-premium">
                {/* Channel Headers */}
                <div className="p-6 border-b border-border/50 bg-muted/30 rounded-t-2xl">
                  <div className="grid grid-cols-[1fr,80px,80px,80px] gap-4 items-center">
                    <span className="text-sm font-medium text-muted-foreground">Notification Type</span>
                    <div className="flex flex-col items-center gap-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Email</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Push</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">SMS</span>
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div className="divide-y divide-border/50">
                  {settings.map((setting) => {
                    const Icon = setting.icon;
                    return (
                      <div
                        key={setting.id}
                        className="grid grid-cols-[1fr,80px,80px,80px] gap-4 items-center p-5 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{setting.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {setting.description}
                            </p>
                          </div>
                        </div>

                        {/* Toggle switches */}
                        {(["email", "push", "sms"] as const).map((channel) => (
                          <div key={channel} className="flex justify-center">
                            <button
                              onClick={() => toggleSetting(setting.id, channel)}
                              className={cn(
                                "relative h-6 w-11 rounded-full transition-colors duration-200",
                                setting[channel]
                                  ? "bg-accent-blue"
                                  : "bg-muted"
                              )}
                            >
                              <div
                                className={cn(
                                  "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                                  setting[channel] ? "left-6" : "left-1"
                                )}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-5 bg-muted/30 border-t border-border/50 rounded-b-2xl">
                  <Button variant="ghost">Reset to Defaults</Button>
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
