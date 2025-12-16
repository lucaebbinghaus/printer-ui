import { NextResponse } from "next/server";

const BASE = process.env.UPDATER_BASE_URL || "http://host.docker.internal:9876";
const TOKEN = process.env.UPDATER_TOKEN || "";

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

export async function POST() {
  const r = await fetch(`${BASE}/update/run`, {
    method: "POST",
    headers: buildHeaders(),
  });

  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
