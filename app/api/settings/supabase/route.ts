import { NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const config = await getConfig();
  const supabase = config.sync.supabase;

  return NextResponse.json({
    enabled: supabase.enabled,
    endpointUrl: supabase.endpointUrl,
    apiKey: supabase.apiKey,
    lastSyncAt: supabase.lastSyncAt,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const config = await getConfig();
  const s = config.sync.supabase;

  const next = {
    ...config,
    sync: {
      ...config.sync,
      supabase: {
        ...s,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : s.enabled,
        endpointUrl: body.endpointUrl !== undefined ? String(body.endpointUrl).trim() : s.endpointUrl,
        apiKey: body.apiKey !== undefined ? String(body.apiKey).trim() : s.apiKey,
      },
    },
  };

  await saveConfig(next);
  return NextResponse.json({ ok: true });
}

