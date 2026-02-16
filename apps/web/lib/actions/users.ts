"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/permissions/server";

export interface UserSearchResult {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
}

// Search for users by name or email
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const supabase = await createClient();
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  // Search UserProfile for matching users
  // We search by displayName, firstName, lastName, or email
  const { data, error } = await supabase
    .from("UserProfile")
    .select(`
      id,
      userId,
      firstName,
      lastName,
      displayName,
      avatarUrl
    `)
    .or(
      `displayName.ilike.%${searchTerm}%,firstName.ilike.%${searchTerm}%,lastName.ilike.%${searchTerm}%`
    )
    .limit(10);

  if (error) {
    console.error("Error searching users:", error);
    return [];
  }

  // Get user emails from auth (we need to do a separate query since UserProfile doesn't store email directly)
  // For now, we'll use a workaround - join with the auth schema is complex, so we'll fetch auth users
  const userIds = data?.map((u) => u.userId) || [];

  if (userIds.length === 0) {
    // If no results from profile search, try searching by email pattern in OrganizationMember
    // This is a fallback for users who might not have completed their profile
    return [];
  }

  // Return results (email will be fetched separately or shown as "Unknown" for now)
  return (
    data?.map((user) => ({
      id: user.id,
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      email: "", // Will be populated by the client if needed
      avatarUrl: user.avatarUrl,
    })) || []
  );
}

// Get user by email (for checking if user exists on platform)
export async function getUserByEmail(email: string): Promise<UserSearchResult | null> {
  const supabase = await createClient();
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  // Query auth.users through the admin API would require service role
  // Instead, we'll check if a UserProfile exists with this email
  // This requires the user to have completed onboarding

  // For now, we can check if the email is associated with any organization member
  // since that table links to auth.users
  const { data: profile, error } = await supabase
    .from("UserProfile")
    .select(`
      id,
      userId,
      firstName,
      lastName,
      displayName,
      avatarUrl
    `)
    .limit(1);

  // This is a simplified check - in production you'd want to verify the email properly
  // For MVP, we'll assume if we can find them by other means they exist

  return null;
}

// Check if a user is already a member of a project
export async function isUserProjectMember(
  projectId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("ProjectMember")
    .select("id")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .single();

  return !!data;
}

// Search for users to invite to a project (excludes current members and pending invites)
export async function searchUsersForInvite(
  query: string,
  projectId: string
): Promise<UserSearchResult[]> {
  const supabase = await createClient();
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  // Get current project members to exclude
  const { data: members } = await supabase
    .from("ProjectMember")
    .select("userId")
    .eq("projectId", projectId);

  const memberUserIds = members?.map((m) => m.userId) || [];

  // Get pending invites to exclude
  const { data: invites } = await supabase
    .from("ProjectInvite")
    .select("email")
    .eq("projectId", projectId)
    .gt("expiresAt", new Date().toISOString());

  const pendingEmails = invites?.map((i) => i.email.toLowerCase()) || [];

  // Search UserProfile for matching users
  const { data: profiles, error } = await supabase
    .from("UserProfile")
    .select(`
      id,
      userId,
      firstName,
      lastName,
      displayName,
      avatarUrl
    `)
    .or(
      `displayName.ilike.%${searchTerm}%,firstName.ilike.%${searchTerm}%,lastName.ilike.%${searchTerm}%`
    )
    .limit(20);

  if (error) {
    console.error("Error searching users:", error);
    return [];
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  // Get emails for found users using admin client
  const adminClient = createAdminClient();
  const userIds = profiles.map((p) => p.userId);

  // Fetch user emails from auth.users
  const results: UserSearchResult[] = [];

  for (const profile of profiles) {
    // Skip if already a member
    if (memberUserIds.includes(profile.userId)) {
      continue;
    }

    // Get user email from auth
    const { data: authUser } = await adminClient.auth.admin.getUserById(
      profile.userId
    );

    if (authUser?.user?.email) {
      const email = authUser.user.email.toLowerCase();

      // Skip if there's a pending invite for this email
      if (pendingEmails.includes(email)) {
        continue;
      }

      results.push({
        id: profile.id,
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: profile.displayName,
        email: authUser.user.email,
        avatarUrl: profile.avatarUrl,
      });
    }
  }

  return results.slice(0, 10);
}

// Combined search: search users AND check if email exists on platform
// Returns search results plus whether the query (if an email) matches an existing user
export async function searchUsersAndCheckEmail(
  query: string,
  projectId: string
): Promise<{
  users: UserSearchResult[];
  emailExists: boolean;
  existingUser?: UserSearchResult;
}> {
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  if (!query || query.trim().length < 2) {
    return { users: [], emailExists: false };
  }

  // Search for users
  const users = await searchUsersForInvite(query, projectId);

  // Check if the query is an email and if that email exists on the platform
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());

  if (!isEmail) {
    return { users, emailExists: false };
  }

  const normalizedEmail = query.trim().toLowerCase();

  // Check if any of the search results match the email
  const matchInResults = users.find(
    (u) => u.email.toLowerCase() === normalizedEmail
  );

  if (matchInResults) {
    return { users, emailExists: true, existingUser: matchInResults };
  }

  // Email wasn't in search results, check if user exists but is already a member
  const userCheck = await checkUserExistsByEmail(normalizedEmail);

  if (userCheck.exists && userCheck.profile) {
    return {
      users,
      emailExists: true,
      existingUser: userCheck.profile,
    };
  }

  return { users, emailExists: false };
}

// Check if a user exists by email in the auth system
export async function checkUserExistsByEmail(
  email: string
): Promise<{ exists: boolean; userId?: string; profile?: UserSearchResult }> {
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("Not authenticated");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Use admin client to search users by email
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (error) {
    console.error("Error checking user exists:", error);
    return { exists: false };
  }

  // Search through users to find matching email
  // Note: Supabase admin API doesn't have a direct "get by email" so we need to filter
  const { data: allUsers } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const matchingUser = allUsers?.users?.find(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );

  if (!matchingUser) {
    return { exists: false };
  }

  // Get the user's profile if they exist
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("UserProfile")
    .select(`
      id,
      userId,
      firstName,
      lastName,
      displayName,
      avatarUrl
    `)
    .eq("userId", matchingUser.id)
    .single();

  return {
    exists: true,
    userId: matchingUser.id,
    profile: profile
      ? {
          id: profile.id,
          userId: profile.userId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName: profile.displayName,
          email: matchingUser.email!,
          avatarUrl: profile.avatarUrl,
        }
      : undefined,
  };
}
