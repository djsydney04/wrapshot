import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let redirectTo = next ?? "/";

      if (user) {
        // Check if this user came from a project invite (metadata from invite email)
        const inviteToken = user.user_metadata?.invite_token;

        if (inviteToken) {
          // Check if there's a valid pending invite for this token
          const { data: invite } = await supabase
            .from("ProjectInvite")
            .select("id, token")
            .eq("token", inviteToken)
            .gt("expiresAt", new Date().toISOString())
            .single();

          if (invite) {
            // Redirect to accept the invite
            redirectTo = `/invites/${invite.token}`;
          }
        }

        // If no invite redirect, check for pending invites by email
        if (redirectTo === (next ?? "/") && user.email) {
          const { data: pendingInvite } = await supabase
            .from("ProjectInvite")
            .select("token")
            .eq("email", user.email.toLowerCase())
            .gt("expiresAt", new Date().toISOString())
            .limit(1)
            .single();

          if (pendingInvite) {
            redirectTo = `/invites/${pendingInvite.token}`;
          }
        }

        // Check if user has completed onboarding (only if not redirecting to invite)
        if (!redirectTo.startsWith("/invites/")) {
          const { data: profile } = await supabase
            .from("UserProfile")
            .select("onboardingCompletedAt")
            .eq("userId", user.id)
            .maybeSingle();

          // Redirect to onboarding if not completed
          if (!profile?.onboardingCompletedAt) {
            redirectTo = "/onboarding";
          }
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${redirectTo}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${redirectTo}`);
      } else {
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
