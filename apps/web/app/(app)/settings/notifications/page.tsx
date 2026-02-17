"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Check,
  Mail,
  Bell,
  Smartphone,
  Clapperboard,
  Calendar,
  AtSign,
  UserPlus,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SettingsLayout,
  SettingsCard,
  SettingsCardFooter,
} from "@/components/layout/settings-layout";

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
    <SettingsLayout
      title="Notifications"
      description="Choose how and when you want to be notified"
      breadcrumbs={[{ label: "Projects", href: "/" }, { label: "Settings", href: "/settings" }, { label: "Notifications" }]}
    >
      <SettingsCard>
        {/* Channel Headers */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="grid grid-cols-[1fr,72px,72px,72px] gap-3 items-center">
            <span className="text-sm font-medium text-muted-foreground">Notification Type</span>
            <div className="flex flex-col items-center gap-0.5">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Email</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Push</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">SMS</span>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="divide-y divide-border">
          {settings.map((setting) => {
            const Icon = setting.icon;
            return (
              <div
                key={setting.id}
                className="grid grid-cols-[1fr,72px,72px,72px] gap-3 items-center p-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{setting.title}</p>
                    <p className="text-xs text-muted-foreground">
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
                        "relative h-5 w-9 rounded-full transition-colors duration-200",
                        setting[channel]
                          ? "bg-foreground"
                          : "bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                          setting[channel] ? "left-[18px]" : "left-0.5"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <SettingsCardFooter>
          <Button variant="ghost">Reset to Defaults</Button>
          <Button onClick={handleSave} className="gap-2">
            {saved && <Check className="h-4 w-4" />}
            {saved ? "Saved" : "Save Changes"}
          </Button>
        </SettingsCardFooter>
      </SettingsCard>
    </SettingsLayout>
  );
}
