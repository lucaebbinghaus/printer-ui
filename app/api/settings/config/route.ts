// app/api/settings/config/route.ts
import { NextResponse } from "next/server";
import { getConfig, saveConfig, AppConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

// Komplette Config lesen
export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (e: any) {
    console.error("GET /api/settings/config failed:", e);
    return new NextResponse(`GET failed: ${e?.message}`, { status: 500 });
  }
}

// Partielle Änderungen per PATCH/POST mergen
export async function POST(req: Request) {
  try {
    const patch = await req.json().catch(() => ({}));

    const current = await getConfig();

    const next: AppConfig = {
      ...current,
      network: {
        ...current.network,
        ...(patch.network || {}),
      },
      printer: {
        ...current.printer,
        ...(patch.printer || {}),
      },
      general: {
        ...current.general,
        ...(patch.general || {}),
      },
      ui: {
        ...current.ui,
        ...(patch.ui || {}),
      },
      sync: {
        supabase: {
          ...current.sync.supabase,
          ...(patch.sync?.supabase || {}),
        },
      },
    };

    // einfache Validierung für defaultLabelQty
    if (patch.general && patch.general.defaultLabelQty !== undefined) {
      const n = Number(patch.general.defaultLabelQty);
      if (!Number.isFinite(n) || n <= 0 || n > 9999) {
        return new NextResponse("validation error: defaultLabelQty", {
          status: 400,
        });
      }
      next.general.defaultLabelQty = Math.floor(n);
    }

    await saveConfig(next);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/settings/config failed:", e);
    return new NextResponse(`POST failed: ${e?.message}`, { status: 500 });
  }
}
