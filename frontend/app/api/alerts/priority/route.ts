import { NextRequest, NextResponse } from "next/server";

import { getPriorityAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sector = request.nextUrl.searchParams.get("sector") ?? undefined;
    const alerts = await getPriorityAlerts(sector);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      alerts,
    });
  } catch (error) {
    console.error("[frontend/api/alerts/priority] failed", error);
    return NextResponse.json(
      { error: "Unable to load priority alerts right now." },
      { status: 500 },
    );
  }
}
