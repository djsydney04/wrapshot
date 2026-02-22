import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendFriendInviteEmail } from "@/lib/email/invites";
import { z } from "zod";

const shareInviteSchema = z.object({
  email: z.string().trim().email().max(320),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = shareInviteSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Please provide a valid email and message (max 1000 characters)." },
        { status: 400 }
      );
    }

    const normalizedEmail = parsedBody.data.email.toLowerCase();
    const normalizedUserEmail = user.email?.toLowerCase();

    if (normalizedUserEmail && normalizedEmail === normalizedUserEmail) {
      return NextResponse.json({ error: "You cannot invite your own email." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("UserProfile")
      .select("firstName, lastName, displayName")
      .eq("userId", user.id)
      .maybeSingle();

    const senderName = profile?.displayName
      || (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : null)
      || profile?.firstName
      || user.email?.split("@")[0]
      || "A friend";

    const rateLimitWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentInviteCount, error: rateLimitError } = await supabase
      .from("FriendInvite")
      .select("id", { head: true, count: "exact" })
      .eq("invitedBy", user.id)
      .gte("createdAt", rateLimitWindow);

    if (!rateLimitError && (recentInviteCount ?? 0) >= 20) {
      return NextResponse.json(
        { error: "Invite limit reached. Please try again later." },
        { status: 429 }
      );
    }

    if (rateLimitError) {
      console.warn("Friend invite rate-limit check failed:", rateLimitError);
    }

    let trackedInvite = false;

    const { error: inviteTrackError } = await supabase
      .from("FriendInvite")
      .upsert(
        {
          invitedBy: user.id,
          email: normalizedEmail,
          message: parsedBody.data.message || null,
          source: "SHARE_MODAL",
          status: "PENDING",
          emailError: null,
          resendEmailId: null,
          sentAt: null,
          updatedAt: new Date().toISOString(),
        },
        { onConflict: "invitedBy,email" }
      );

    if (!inviteTrackError) {
      trackedInvite = true;
    } else {
      console.warn("Friend invite tracking insert failed:", inviteTrackError);
    }

    const result = await sendFriendInviteEmail({
      toEmail: normalizedEmail,
      inviterName: senderName,
      inviterEmail: user.email ?? null,
      message: parsedBody.data.message || undefined,
    });

    if (!result.sent) {
      if (trackedInvite) {
        await supabase
          .from("FriendInvite")
          .update({
            status: "FAILED",
            emailError: result.error ?? "Unknown email delivery error",
            updatedAt: new Date().toISOString(),
          })
          .eq("invitedBy", user.id)
          .eq("email", normalizedEmail);
      }

      const status = result.error?.includes("RESEND_API_KEY is not configured") ? 503 : 502;
      return NextResponse.json(
        { error: result.error || "Failed to send invite email" },
        { status }
      );
    }

    if (trackedInvite) {
      await supabase
        .from("FriendInvite")
        .update({
          status: "SENT",
          resendEmailId: result.providerId ?? null,
          emailError: null,
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq("invitedBy", user.id)
        .eq("email", normalizedEmail);
    }

    return NextResponse.json({ success: true, id: result.providerId ?? null });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
