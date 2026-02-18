import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { getFullCallSheetData } from "@/lib/actions/call-sheets";
import { CallSheetPdf } from "@/lib/pdf/call-sheet-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shootingDayId: string }> }
) {
  try {
    const { shootingDayId } = await params;

    // Authenticate
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { recipients } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients are required" }, { status: 400 });
    }

    // Validate emails
    const validRecipients = recipients.filter(
      (r: { name: string; email: string }) => r.email && typeof r.email === "string"
    );

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: "No valid email addresses" }, { status: 400 });
    }

    // Get shooting day to find projectId
    const { data: shootingDay, error: sdError } = await supabase
      .from("ShootingDay")
      .select("projectId")
      .eq("id", shootingDayId)
      .single();

    if (sdError || !shootingDay) {
      return NextResponse.json({ error: "Shooting day not found" }, { status: 404 });
    }

    // Get full call sheet data
    const { data, error: dataError } = await getFullCallSheetData(shootingDayId, shootingDay.projectId);

    if (dataError || !data) {
      return NextResponse.json({ error: dataError || "Failed to load data" }, { status: 500 });
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(CallSheetPdf, { data }) as any
    );

    const projectName = data.project?.name || "Production";
    const dayNum = data.shootingDay.dayNumber;
    const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_Day${dayNum}_CallSheet.pdf`;

    // Get sender's name
    const { data: profile } = await supabase
      .from("UserProfile")
      .select("firstName, lastName, displayName")
      .eq("userId", user.id)
      .single();

    const senderName =
      profile?.displayName ||
      (profile?.firstName && profile?.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : null) ||
      profile?.firstName ||
      user.email?.split("@")[0] ||
      "Production";

    // Format date for email subject
    let dateStr = "";
    try {
      const d = new Date(data.shootingDay.date);
      dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      dateStr = data.shootingDay.date;
    }

    // Send emails
    const emailPromises = validRecipients.map(
      (recipient: { name: string; email: string }) =>
        getResend().emails.send({
          from: "wrapshoot <noreply@wrapshoot.com>",
          to: recipient.email,
          subject: `Call Sheet — ${projectName} Day ${dayNum} (${dateStr})`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="margin: 0 0 8px 0;">${projectName}</h2>
              <p style="margin: 0 0 16px 0; color: #666;">Call Sheet — Day ${dayNum} (${dateStr})</p>
              <p style="margin: 0 0 16px 0;">Hi ${recipient.name},</p>
              <p style="margin: 0 0 16px 0;">Please find the call sheet for Day ${dayNum} attached.</p>
              ${data.shootingDay.generalCall ? `<p style="margin: 0 0 4px 0;"><strong>General Call:</strong> ${data.shootingDay.generalCall}</p>` : ""}
              ${data.shootingDay.estimatedWrap ? `<p style="margin: 0 0 16px 0;"><strong>Estimated Wrap:</strong> ${data.shootingDay.estimatedWrap}</p>` : ""}
              <p style="margin: 16px 0 0 0; color: #999; font-size: 12px;">Sent by ${senderName} via wrapshoot</p>
            </div>
          `,
          attachments: [
            {
              filename,
              content: Buffer.from(pdfBuffer),
            },
          ],
          replyTo: user.email || undefined,
        })
    );

    const results = await Promise.allSettled(emailPromises);
    const failures = results.filter((r) => r.status === "rejected");

    if (failures.length === results.length) {
      return NextResponse.json({ error: "Failed to send all emails" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sent: results.length - failures.length,
      failed: failures.length,
    });
  } catch (error) {
    console.error("Distribute API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
