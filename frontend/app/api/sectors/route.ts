import { NextResponse } from "next/server";

import { getSectors } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sectors = await getSectors();
    return NextResponse.json({ sectors });
  } catch (error) {
    console.error("[frontend/api/sectors] failed", error);
    return NextResponse.json(
      { error: "Unable to load sectors right now." },
      { status: 500 },
    );
  }
}
