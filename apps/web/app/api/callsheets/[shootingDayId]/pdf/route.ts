import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { getFullCallSheetData } from "@/lib/actions/call-sheets";
import { CallSheetPdf } from "@/lib/pdf/call-sheet-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
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
    const { data, error } = await getFullCallSheetData(shootingDayId, shootingDay.projectId);

    if (error || !data) {
      return NextResponse.json({ error: error || "Failed to load data" }, { status: 500 });
    }

    // Render PDF
    const buffer = await renderToBuffer(
      React.createElement(CallSheetPdf, { data }) as any
    );

    const projectName = data.project?.name || "Production";
    const dayNum = data.shootingDay.dayNumber;
    const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_Day${dayNum}_CallSheet.pdf`;

    return new NextResponse(Buffer.from(buffer) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
