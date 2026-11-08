import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { config } from "@/server/config";

/** GET /api/health: liveness + database check for uptime monitors. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", mode: config.realMoneyEnabled ? "real-money" : "demo", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
