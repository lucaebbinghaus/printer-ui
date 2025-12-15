// app/api/update/run/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const base = process.env.UPDATER_BASE_URL || "http://host.docker.internal:9123";
    const token = process.env.UPDATER_TOKEN || "";

    const res = await fetch(`${base}/run`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Could not reach updater service" },
      { status: 500 }
    );
  }
}
