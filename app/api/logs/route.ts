// app/api/logs/route.ts
import { NextResponse } from "next/server";
import { getLogs, clearLogs } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "1000", 10);
    const logs = getLogs(limit);

    return NextResponse.json({
      ok: true,
      logs,
      count: logs.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Failed to fetch logs",
        logs: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    clearLogs();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to clear logs" },
      { status: 500 }
    );
  }
}

