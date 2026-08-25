import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await pool.query(`SELECT * FROM "Vault_State" WHERE id='singleton'`);
    if (r.rows.length === 0) {
      const ins = await pool.query(`INSERT INTO "Vault_State" (id, reserve_usd, daily_limit_usd, disbursed_today_usd) VALUES ('singleton', 1000000, 100000, 0) RETURNING *`);
      return NextResponse.json({ vault: ins.rows[0] });
    }
    const v = r.rows[0];
    return NextResponse.json({
      vault: {
        reserveUSD: Number(v.reserve_usd),
        dailyLimitUSD: Number(v.daily_limit_usd),
        disbursedTodayUSD: Number(v.disbursed_today_usd),
        remainingDaily: Number(v.daily_limit_usd) - Number(v.disbursed_today_usd),
        pctUsed: Number(v.daily_limit_usd) > 0 ? Math.round((Number(v.disbursed_today_usd) / Number(v.daily_limit_usd)) * 100) : 0,
        lastResetAt: v.last_reset_at,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json() as { amount?: number };
    if (!amount || amount <= 0) return NextResponse.json({ error: "amount > 0 required" }, { status: 400 });
    await pool.query(`UPDATE "Vault_State" SET reserve_usd = reserve_usd + $1 WHERE id='singleton'`, [amount]);
    return NextResponse.json({ ok: true, deposited: amount });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}