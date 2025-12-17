import { NextResponse } from "next/server";

const BASE = process.env.UPDATER_BASE_URL || "http://host.docker.internal:9876";
const TOKEN = process.env.UPDATER_TOKEN || "";

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

export async function POST() {
  try {
    const r = await fetch(`${BASE}/update/clear-log`, {
      method: "POST",
      headers: buildHeaders(),
    });

    const json = await r.json().catch(() => ({}));
    return NextResponse.json(json, { status: r.status });
  } catch (e: any) {
    console.error("[UPDATE/CLEAR-LOG] Error connecting to host-api:", e.message);
    return NextResponse.json(
      { ok: false, error: "Host update API not available", details: e.message },
      { status: 503 }
    );
  }
}
