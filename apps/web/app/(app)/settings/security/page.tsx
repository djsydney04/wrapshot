"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Smartphone,
  Monitor,
  MapPin,
  Clock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SettingsLayout,
  SettingsCard,
  SettingsCardHeader,
  SettingsCardBody,
  SettingsCardFooter,
  DangerZone,
} from "@/components/layout/settings-layout";

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
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);

  return (
    <SettingsLayout
      title="Security"
      description="Manage your password and account security"
      breadcrumbs={[{ label: "Projects", href: "/" }, { label: "Settings", href: "/settings" }, { label: "Security" }]}
    >
      {/* Password */}
      <SettingsCard>
        <SettingsCardHeader
          title="Password"
          description="Update your password"
          icon={Key}
        />

        <SettingsCardBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-sm font-medium">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="Enter current password"
              className="h-10"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                className="h-10"
              />
            </div>
          </div>
        </SettingsCardBody>

        <SettingsCardFooter>
          <Button>Update Password</Button>
        </SettingsCardFooter>
      </SettingsCard>

      {/* Two-Factor Authentication */}
      <SettingsCard>
        <SettingsCardBody>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                twoFactorEnabled ? "bg-emerald-50" : "bg-muted"
              )}>
                <Smartphone className={cn(
                  "h-5 w-5",
                  twoFactorEnabled ? "text-emerald-600" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">Two-Factor Authentication</h2>
                  {twoFactorEnabled && (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0">
                      <Check className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {twoFactorEnabled
                    ? "Your account is protected with 2FA"
                    : "Add an extra layer of security"}
                </p>
              </div>
            </div>
            <Button
              variant={twoFactorEnabled ? "outline" : "default"}
              onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
            >
              {twoFactorEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </SettingsCardBody>
      </SettingsCard>

      {/* Active Sessions */}
      <SettingsCard>
        <SettingsCardHeader
          title="Active Sessions"
          description="Manage your logged in devices"
          icon={Monitor}
          action={<Button variant="outline" size="sm">Sign Out All</Button>}
        />

        <div className="divide-y divide-border">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center gap-4 p-4">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                session.current ? "bg-blue-50" : "bg-muted"
              )}>
                <Monitor className={cn(
                  "h-4 w-4",
                  session.current ? "text-blue-600" : "text-muted-foreground"
                )} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{session.device}</p>
                  {session.current && (
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-0 text-xs">
                      This device
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
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
      </SettingsCard>

      {/* Danger Zone */}
      <DangerZone
        title="Delete Account"
        description="Permanently delete your account and all associated data"
        action={
          <Button variant="destructive" size="sm">
            Delete Account
          </Button>
        }
      />
    </SettingsLayout>
  );
}
