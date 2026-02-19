"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { Camera, Check } from "lucide-react";
import {
  SettingsLayout,
  SettingsCard,
  SettingsCardBody,
  SettingsCardFooter,
} from "@/components/layout/settings-layout";

export default function SettingsPage() {
  const [saved, setSaved] = React.useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SettingsLayout
      title="Profile"
      description="Manage your personal information and preferences"
    >
      {/* Avatar Section */}
      <SettingsCard>
        <SettingsCardBody>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative group">
              <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                <Avatar size="lg" alt="User" className="h-16 w-16" />
              </div>
              <button className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </button>
            </div>
            <div className="space-y-1">
              <h3 className="font-medium">Profile Photo</h3>
              <p className="text-sm text-muted-foreground">
                JPG, PNG or GIF. Max 5MB.
              </p>
              <div className="mt-3 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="outline" size="sm">Upload</Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground">Remove</Button>
              </div>
            </div>
          </div>
        </SettingsCardBody>
      </SettingsCard>

      {/* Form Fields */}
      <SettingsCard>
        <SettingsCardBody className="space-y-4">
          {/* Name Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                defaultValue=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                defaultValue=""
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
            />
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">Job Title</Label>
            <Input
              id="title"
              placeholder="Production Coordinator"
              defaultValue=""
            />
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-sm font-medium">Timezone</Label>
            <select
              id="timezone"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        </SettingsCardBody>

        <SettingsCardFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="skeuo" onClick={handleSave} className="gap-2">
            {saved && <Check className="h-4 w-4" />}
            {saved ? "Saved" : "Save Changes"}
          </Button>
        </SettingsCardFooter>
      </SettingsCard>
    </SettingsLayout>
  );
}
