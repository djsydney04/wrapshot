"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveOnboardingProfile(data: {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  avatarUrl?: string;
  timezone: string;
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
      timezone: data.timezone || "America/Los_Angeles",
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

export async function createOnboardingOrganization(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from("Organization")
    .insert({
      name,
      slug: `${slug}-${Date.now().toString(36)}`,
    })
    .select()
    .single();

  if (orgError) {
    console.error("Error creating organization:", orgError);
    throw new Error("Failed to create organization");
  }

  // Add user as owner
  const { error: memberError } = await supabase
    .from("OrganizationMember")
    .insert({
      organizationId: org.id,
      userId: user.id,
      role: "OWNER",
    });

  if (memberError) {
    console.error("Error adding member:", memberError);
    throw new Error("Failed to add member to organization");
  }

  // Create a default subscription (free plan)
  await supabase.from("Subscription").insert({
    organizationId: org.id,
    status: "TRIALING",
    plan: "FREE",
  });

  revalidatePath("/");
  return org;
}

export async function joinOrganizationByCode(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Find invitation by code/token
  const { data: invitation, error: inviteError } = await supabase
    .from("OrganizationInvitation")
    .select("id, organizationId, role, expiresAt")
    .eq("token", code)
    .single();

  if (inviteError || !invitation) {
    throw new Error("Invalid or expired invite code");
  }

  // Check if expired
  if (new Date(invitation.expiresAt) < new Date()) {
    throw new Error("This invite code has expired");
  }

  // Add user to organization
  const { error: memberError } = await supabase
    .from("OrganizationMember")
    .insert({
      organizationId: invitation.organizationId,
      userId: user.id,
      role: invitation.role || "MEMBER",
    });

  if (memberError) {
    if (memberError.code === "23505") {
      throw new Error("You are already a member of this organization");
    }
    throw new Error("Failed to join organization");
  }

  // Delete the used invitation
  await supabase.from("OrganizationInvitation").delete().eq("id", invitation.id);

  revalidatePath("/");
  return { success: true };
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
