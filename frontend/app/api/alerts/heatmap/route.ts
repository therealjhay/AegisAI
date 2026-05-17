import { NextRequest, NextResponse } from "next/server";

import { getHeatmapPoints } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sector = request.nextUrl.searchParams.get("sector") ?? undefined;
    const points = await getHeatmapPoints(sector);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      points,
    });
  } catch (error) {
    console.error("[frontend/api/alerts/heatmap] failed", error);
    return NextResponse.json(
      { error: "Unable to load heatmap alerts right now." },
      { status: 500 },
    );
  }
}
