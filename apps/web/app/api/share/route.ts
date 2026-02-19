import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

// Lazy initialize Resend to avoid build-time errors when API key is not set
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

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

    const body = await request.json();
    const { email, message } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Get sender's name from profile
    const { data: profile } = await supabase
      .from("UserProfile")
      .select("firstName, lastName, displayName")
      .eq("userId", user.id)
      .single();

    const senderName = profile?.displayName
      || (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : null)
      || profile?.firstName
      || user.email?.split("@")[0]
      || "A friend";

    const landingPageUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wrapshoot.com";

    // Build email content
    const personalMessage = message
      ? `<p style="margin: 0 0 20px 0; padding: 16px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #6366f1; font-style: italic; color: #4b5563;">"${message}"</p>`
      : "";

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 600; margin: 0; color: #111827;">wrapshoot</h1>
    <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 14px;">Film Production Scheduling</p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
    <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">
      ${senderName} invited you to try wrapshoot
    </h2>

    ${personalMessage}

    <p style="margin: 0 0 24px 0; color: #4b5563;">
      wrapshoot is a production management tool for filmmakers. Manage scenes, schedules, call sheets, and budgets all in one place.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${landingPageUrl}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 500; font-size: 16px;">
        Check it out
      </a>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        <strong>Features include:</strong>
      </p>
      <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
        <li>Scene breakdown & script management</li>
        <li>Drag-and-drop stripboard scheduling</li>
        <li>Cast & crew management</li>
        <li>Budget tracking</li>
        <li>Call sheet generation</li>
      </ul>
    </div>
  </div>

  <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This invitation was sent by ${senderName} (${user.email})</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${landingPageUrl}" style="color: #6b7280;">wrapshoot.com</a>
    </p>
  </div>
</body>
</html>
    `;

    // Send email via Resend
    const { data, error } = await getResend().emails.send({
      from: "wrapshoot <noreply@wrapshoot.com>",
      to: email,
      subject: `${senderName} invited you to try wrapshoot`,
      html: htmlContent,
      replyTo: user.email || undefined,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
