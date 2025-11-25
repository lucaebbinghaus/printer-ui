// app/api/sync/xano-products/route.ts

import { NextResponse } from "next/server";
import { writeProducts, type Preset } from "@/app/lib/productsStore";
import { getConfig, saveConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

export async function POST() {
  try {
    console.log("[/api/sync/xano-products] START");

    const config = await getConfig();
    const xano = config.sync?.xano;

    if (!xano?.enabled) {
      console.warn("[sync] Xano sync disabled");
      return new NextResponse("Xano sync disabled.", { status: 400 });
    }

    if (!xano.baseUrl) {
      return new NextResponse("Xano baseUrl missing.", { status: 400 });
    }

    const printerId = (xano.printerId || "").trim();
    if (!printerId) {
      return new NextResponse("printerId missing.", { status: 400 });
    }

    // URL bauen
    const base = xano.baseUrl.replace(/\/$/, "");
    const endpoint = (xano.productsEndpoint || "/products").trim();
    const url = `${base}${endpoint}?printerId=${encodeURIComponent(printerId)}`;

    console.log("[sync] Xano sync URL:", url);

    // Request
    const res = await fetch(url, {
      headers: {
        ...(xano.apiKey ? { Authorization: `Bearer ${xano.apiKey}` } : {}),
        "x-printer-id": printerId,
      },
      cache: "no-store",
    });

    // Nur für Logging Response als Text erfassen
    const rawText = await res.text();

    if (!res.ok) {
      console.error("[sync] Xano responded with error:", res.status, rawText);
      return new NextResponse(
        `Xano error ${res.status}: ${rawText.slice(0, 300)}`,
        { status: 500 }
      );
    }

    // JSON parsen
    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch (err) {
      console.error("[sync] JSON parse error:", rawText);
      return new NextResponse("Xano returned invalid JSON.", { status: 500 });
    }

    // Mehrere mögliche Datenformen unterstützen
    const items: Preset[] =
      Array.isArray(json) ? json :
      Array.isArray(json?.items) ? json.items :
      Array.isArray(json?.data) ? json.data :
      null;

    if (!items) {
      console.error("[sync] Unexpected JSON shape:", json);
      return new NextResponse("Unexpected Xano response shape.", { status: 500 });
    }

    console.log("[sync] Received items:", items.length);

    // → Schreibvorgang in zentrale Datei (wichtig!)
    await writeProducts(items);

    // Config aktualisieren
    await saveConfig({
      ...config,
      sync: {
        ...config.sync,
        xano: {
          ...xano,
          lastSyncAt: new Date().toISOString(),
        },
      },
    });

    console.log("[/api/sync/xano-products] DONE - stored:", items.length);

    return NextResponse.json({
      ok: true,
      count: items.length,
    });

  } catch (err: any) {
    console.error("[/api/sync/xano-products] FAILED:", err);
    return new NextResponse(
      `Sync failed: ${err?.message || "unknown error"}`,
      { status: 500 }
    );
  }
}
