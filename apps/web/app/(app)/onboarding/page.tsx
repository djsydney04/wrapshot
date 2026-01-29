"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Briefcase,
  Settings,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveOnboardingProfile,
  completeOnboarding,
} from "@/lib/actions/onboarding";

type Step = 1 | 2 | 3 | 4;

const JOB_TITLES = [
  { value: "producer", label: "Producer" },
  { value: "executive_producer", label: "Executive Producer" },
  { value: "director", label: "Director" },
  { value: "assistant_director", label: "Assistant Director (AD)" },
  { value: "unit_production_manager", label: "Unit Production Manager" },
  { value: "production_coordinator", label: "Production Coordinator" },
  { value: "production_assistant", label: "Production Assistant" },
  { value: "cinematographer", label: "Cinematographer / DP" },
  { value: "editor", label: "Editor" },
  { value: "production_designer", label: "Production Designer" },
  { value: "sound_designer", label: "Sound Designer" },
  { value: "other", label: "Other" },
];

const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [timezone, setTimezone] = React.useState("America/Los_Angeles");

  // Detect timezone on mount
  React.useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = TIMEZONES.find((tz) => tz.value === detected);
    if (match) {
      setTimezone(detected);
    }
  }, []);

  const canProceed = React.useMemo(() => {
    switch (step) {
      case 1:
        return firstName.trim().length > 0 && lastName.trim().length > 0;
      case 2:
        return true; // Optional
      case 3:
        return true; // Has defaults
      case 4:
        return true;
      default:
        return false;
    }
  }, [step, firstName, lastName]);

  const handleNext = async () => {
    setError(null);

    if (step < 4) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleComplete = async (withTour: boolean) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Save profile
      await saveOnboardingProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle || undefined,
        avatarUrl: avatarUrl || undefined,
        timezone,
      });

      // Complete onboarding
      await completeOnboarding();

      // Small delay for UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (withTour) {
        router.push("/?startTour=true");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed && step < 5) {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex items-center justify-center border-b border-border px-6 py-4">
        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 w-8 rounded-full transition-colors",
                s <= step ? "bg-foreground" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-xl px-6 py-12">
          {/* Step 1: Welcome + Name */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-2xl font-semibold">Welcome to wrapshoot</h1>
                <p className="text-muted-foreground mt-2">
                  Let&apos;s set up your account. What&apos;s your name?
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-12 text-lg"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Profile */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-semibold">Tell us about yourself</h1>
                <p className="text-muted-foreground mt-2">
                  This helps us personalize your experience
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <Label className="text-sm font-medium">Profile Photo</Label>
                  <ImageUpload
                    value={avatarUrl}
                    onChange={setAvatarUrl}
                    bucket="profile-photos"
                    folder="avatars"
                    aspectRatio="square"
                    className="w-24 h-24"
                  />
                  <p className="text-xs text-muted-foreground">Optional</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobTitle">What&apos;s your role?</Label>
                  <select
                    id="jobTitle"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select your role...</option>
                    {JOB_TITLES.map((job) => (
                      <option key={job.value} value={job.value}>
                        {job.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-semibold">Preferences</h1>
                <p className="text-muted-foreground mt-2">
                  Set your timezone for accurate scheduling
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    We detected your timezone automatically. Change it if needed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 4 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-semibold">You&apos;re all set!</h1>
                <p className="text-muted-foreground mt-2">
                  Welcome aboard, <strong>{firstName}</strong>. Ready to get started?
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => handleComplete(true)}
                  disabled={isSubmitting}
                  className="w-full p-4 rounded-xl border-2 border-border hover:border-foreground bg-card transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium group-hover:text-foreground">
                        Take a quick tour
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Learn the basics in under a minute
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleComplete(false)}
                  disabled={isSubmitting}
                  className="w-full p-4 rounded-xl border-2 border-border hover:border-foreground bg-card transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium group-hover:text-foreground">
                        Jump right in
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        I&apos;ll explore on my own
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Setting up your account...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      {step < 4 && (
        <div className="border-t border-border px-6 py-4">
          <div className="mx-auto max-w-xl flex items-center justify-between">
            <div>
              {step > 1 && (
                <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {(step === 2 || step === 3) && (
                <Button variant="ghost" onClick={handleNext} disabled={isSubmitting}>
                  Skip
                </Button>
              )}
              <Button onClick={handleNext} disabled={!canProceed || isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
