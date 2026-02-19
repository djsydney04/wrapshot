"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendOnboardingInviteEmail } from "@/lib/email/invites";

export async function saveOnboardingProfile(data: {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  avatarUrl?: string;
  productionType?: string;
  referralSource?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const displayName = `${data.firstName} ${data.lastName}`.trim();

  const { error } = await supabase.from("UserProfile").upsert(
    {
      userId: user.id,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName,
      jobTitle: data.jobTitle || null,
      avatarUrl: data.avatarUrl || null,
      productionType: data.productionType || null,
      referralSource: data.referralSource || null,
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "userId" }
  );

  if (error) {
    console.error("Error saving profile:", error);
    throw new Error("Failed to save profile");
  }

  revalidatePath("/");
  return { success: true };
}

export async function sendOnboardingInvites(emails: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const validEmails = emails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e.includes("@"));

  if (validEmails.length === 0) {
    return { success: true, sent: 0 };
  }

  // Insert invites (ignore duplicates)
  const invites = validEmails.map((email) => ({
    invitedBy: user.id,
    email,
    status: "PENDING",
  }));

  const { error } = await supabase
    .from("OnboardingInvite")
    .upsert(invites, { onConflict: "invitedBy,email", ignoreDuplicates: true });

  if (error) {
    console.error("Error sending invites:", error);
    throw new Error("Failed to send invites");
  }

  const { data: profile } = await supabase
    .from("UserProfile")
    .select("firstName, lastName, displayName")
    .eq("userId", user.id)
    .maybeSingle();

  const inviterName =
    profile?.displayName ||
    `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
    user.email?.split("@")[0] ||
    "A team member";

  const emailResults = await Promise.all(
    validEmails.map(async (email) => {
      const result = await sendOnboardingInviteEmail({
        toEmail: email,
        inviterName,
        inviterEmail: user.email ?? null,
      });

      if (!result.sent && result.error) {
        console.warn(`Onboarding invite email failed for ${email}:`, result.error);
      }

      return result;
    })
  );

  const sentCount = emailResults.filter((result) => result.sent).length;

  return { success: true, sent: sentCount };
}

export async function updateOnboardingStep(step: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  await supabase
    .from("UserProfile")
    .update({ onboardingStep: step })
    .eq("userId", user.id);

  return { success: true };
}

export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("UserProfile")
    .update({
      onboardingCompletedAt: new Date().toISOString(),
      onboardingStep: 5,
    })
    .eq("userId", user.id);

  if (error) {
    console.error("Error completing onboarding:", error);
    throw new Error("Failed to complete onboarding");
  }

  revalidatePath("/");
  return { success: true };
}

export async function completeTour() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("UserProfile")
    .update({ tourCompletedAt: new Date().toISOString() })
    .eq("userId", user.id);

  if (error) {
    console.error("Error completing tour:", error);
    throw new Error("Failed to complete tour");
  }

  revalidatePath("/");
  return { success: true };
}
