"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { ArrowRight, Loader2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveOnboardingProfile,
  sendOnboardingInvites,
  completeOnboarding,
} from "@/lib/actions/onboarding";

type Step = 1 | 2 | 3 | 4;

const ROLES = [
  "Producer",
  "Executive Producer",
  "Director",
  "Assistant Director",
  "Production Manager",
  "Production Coordinator",
  "Cinematographer",
  "Editor",
  "Other",
];

const PRODUCTION_TYPES = [
  { id: "feature", label: "Feature Film" },
  { id: "short", label: "Short Film" },
  { id: "tv_series", label: "TV Series" },
  { id: "documentary", label: "Documentary" },
  { id: "commercial", label: "Commercial" },
  { id: "music_video", label: "Music Video" },
  { id: "corporate", label: "Corporate Video" },
  { id: "other", label: "Other" },
];

const REFERRAL_SOURCES = [
  { id: "google", label: "Google search" },
  { id: "friend", label: "Friend or colleague" },
  { id: "social", label: "Social media" },
  { id: "blog", label: "Blog or article" },
  { id: "conference", label: "Conference or event" },
  { id: "other", label: "Other" },
];

export default function OnboardingPage() {
  const [step, setStep] = React.useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 1: Profile
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);

  // Step 2: Production type
  const [productionType, setProductionType] = React.useState("");

  // Step 3: Invite team
  const [emails, setEmails] = React.useState<string[]>([""]);

  // Step 4: Referral
  const [referralSource, setReferralSource] = React.useState("");

  const canProceed = React.useMemo(() => {
    switch (step) {
      case 1:
        return firstName.trim().length > 0 && lastName.trim().length > 0;
      case 2:
        return productionType !== "";
      case 3:
        return true; // Optional
      case 4:
        return referralSource !== "";
      default:
        return false;
    }
  }, [step, firstName, lastName, productionType, referralSource]);

  const handleNext = () => {
    setError(null);
    if (step < 4) {
      setStep((step + 1) as Step);
    }
  };

  const handleAddEmail = () => {
    if (emails.length < 5) {
      setEmails([...emails, ""]);
    }
  };

  const handleRemoveEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleComplete = async (withTour: boolean) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await saveOnboardingProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: role || undefined,
        avatarUrl: avatarUrl || undefined,
        productionType,
        referralSource,
      });

      const validEmails = emails.filter((e) => e.trim() && e.includes("@"));
      if (validEmails.length > 0) {
        await sendOnboardingInvites(validEmails);
      }

      await completeOnboarding();

      await new Promise((resolve) => setTimeout(resolve, 200));

      if (withTour) {
        window.location.href = "/?tour=1";
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted">
        <div
          className="h-full bg-foreground transition-all duration-300"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      <div className="mx-auto max-w-lg px-4 pb-12 pt-16 sm:px-6">
        {/* Branding */}
        <div className="mb-10 flex justify-center sm:mb-12">
          <span className="text-xl font-semibold tracking-tight">wrapshoot</span>
        </div>
        {/* Step 1: Profile */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Step 1 of 4</p>
              <h1 className="text-xl font-semibold tracking-tight">
                Let&apos;s set up your profile
              </h1>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <ImageUpload
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  bucket="profile-photos"
                  folder="avatars"
                  aspectRatio="square"
                  className="w-20 h-20 rounded-full"
                  placeholder=""
                />
                <p className="text-sm text-muted-foreground">
                  Add a profile photo
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">What&apos;s your role?</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a role</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Production Type */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Step 2 of 4</p>
              <h1 className="text-xl font-semibold tracking-tight">
                What are you working on?
              </h1>
              <p className="text-muted-foreground mt-2">
                This helps us tailor the experience for you.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {PRODUCTION_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setProductionType(type.id)}
                  className={cn(
                    "px-4 py-3 rounded-lg border text-left text-sm font-medium transition-colors",
                    productionType === type.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/50"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 3: Invite Team */}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Step 3 of 4</p>
              <h1 className="text-xl font-semibold tracking-tight">
                Invite your team
              </h1>
              <p className="text-muted-foreground mt-2">
                Production is a team sport. Add collaborators now or later.
              </p>
            </div>

            <div className="space-y-3">
              {emails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    placeholder="colleague@email.com"
                    className="flex-1"
                  />
                  {emails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEmail(index)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {emails.length < 5 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAddEmail}
                  className="w-full text-muted-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add another
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={handleNext}
                className="w-full sm:flex-1"
              >
                Skip for now
              </Button>
              <Button
                onClick={handleNext}
                disabled={!emails.some((e) => e.trim() && e.includes("@"))}
                className="w-full sm:flex-1"
              >
                Send invites
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Referral */}
        {step === 4 && (
          <div className="space-y-8">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Step 4 of 4</p>
              <h1 className="text-xl font-semibold tracking-tight">
                How did you find us?
              </h1>
              <p className="text-muted-foreground mt-2">
                We&apos;d love to know what brought you here.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              {REFERRAL_SOURCES.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setReferralSource(source.id)}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border text-left text-sm transition-colors",
                    referralSource === source.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/50"
                  )}
                >
                  {source.label}
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-4">
              <Button
                onClick={() => handleComplete(false)}
                disabled={!canProceed || isSubmitting}
                className="w-full"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Get started
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleComplete(true)}
                disabled={!canProceed || isSubmitting}
                className="w-full text-muted-foreground"
              >
                Take a quick tour first
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
