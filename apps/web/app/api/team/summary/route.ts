import { NextResponse } from "next/server";
import { getCurrentTeamSummary } from "@/lib/team/server";

export async function GET() {
  try {
    const summary = await getCurrentTeamSummary();
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load team summary" }, { status: 500 });
  }
}

