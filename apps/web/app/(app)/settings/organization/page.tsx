"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Check, Upload } from "lucide-react";
import {
  SettingsLayout,
  SettingsCard,
  SettingsCardBody,
  SettingsCardFooter,
  DangerZone,
} from "@/components/layout/settings-layout";

export default function OrganizationSettingsPage() {
  const [saved, setSaved] = React.useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SettingsLayout
      title="Organization"
      description="Manage your organization settings and branding"
      breadcrumbs={[{ label: "Settings" }, { label: "Organization" }]}
    >
      {/* Logo Section */}
      <SettingsCard>
        <SettingsCardBody>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <button className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-4 w-4 text-white" />
              </button>
            </div>
            <div className="space-y-1">
              <h3 className="font-medium">Organization Logo</h3>
              <p className="text-sm text-muted-foreground">
                PNG, JPG up to 2MB. Recommended 256x256px.
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground">Remove</Button>
              </div>
            </div>
          </div>
        </SettingsCardBody>
      </SettingsCard>

      {/* Organization Details */}
      <SettingsCard>
        <SettingsCardBody className="space-y-5">
          {/* Organization Name */}
          <div className="space-y-2">
            <Label htmlFor="orgName" className="text-sm font-medium">Organization Name</Label>
            <Input
              id="orgName"
              placeholder="Acme Productions"
              defaultValue=""
              className="h-10"
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="orgSlug" className="text-sm font-medium">URL Slug</Label>
            <div className="flex items-center gap-0">
              <span className="flex h-10 items-center px-3 text-sm text-muted-foreground bg-muted rounded-l-md border border-r-0 border-input">
                setsync.app/
              </span>
              <Input
                id="orgSlug"
                placeholder="acme-productions"
                defaultValue=""
                className="h-10 rounded-l-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for your organization&apos;s unique URL
            </p>
          </div>
        </SettingsCardBody>

        <div className="border-t border-border" />

        <SettingsCardBody className="space-y-5">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Contact Information</h3>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orgEmail" className="text-sm font-medium">Email</Label>
              <Input
                id="orgEmail"
                type="email"
                placeholder="contact@acmeproductions.com"
                defaultValue=""
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgPhone" className="text-sm font-medium">Phone</Label>
              <Input
                id="orgPhone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                defaultValue=""
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="orgAddress" className="text-sm font-medium">Address</Label>
            <Input
              id="orgAddress"
              placeholder="123 Production Way, Los Angeles, CA"
              defaultValue=""
              className="h-10"
            />
          </div>
        </SettingsCardBody>

        <SettingsCardFooter className="justify-between">
          <div className="text-sm text-muted-foreground">
            Organization ID: <code className="text-xs bg-muted px-2 py-1 rounded">org_abc123</code>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost">Cancel</Button>
            <Button onClick={handleSave} className="gap-2">
              {saved && <Check className="h-4 w-4" />}
              {saved ? "Saved" : "Save Changes"}
            </Button>
          </div>
        </SettingsCardFooter>
      </SettingsCard>

      {/* Danger Zone */}
      <DangerZone
        title="Delete Organization"
        description="Permanently delete your organization and all its data"
        action={
          <Button variant="destructive" size="sm">
            Delete Organization
          </Button>
        }
      />
    </SettingsLayout>
  );
}
