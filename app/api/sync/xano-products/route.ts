import { NextResponse } from "next/server";
import { getConfig, saveConfig, saveProducts } from "@/app/lib/storage";

export const runtime = "nodejs";

export async function POST() {
  try {
    const config = await getConfig();
    const xano = config.sync.xano;

    if (!xano.enabled) {
      return new NextResponse("Xano sync disabled (enabled=false).", { status: 400 });
    }
    if (!xano.baseUrl) {
      return new NextResponse("Xano baseUrl missing.", { status: 400 });
    }

    const printerId = (xano.printerId || "").trim();
    if (!printerId) {
      return new NextResponse("printerId missing (auth_token).", { status: 400 });
    }

    const base = xano.baseUrl.replace(/\/$/, "");
    const endpoint = xano.productsEndpoint || "/products";

    // --- WÄHLE GENAU EINE VARIANTE ---
    // Variante A (Query Param)
    const url = `${base}${endpoint}?printerId=${encodeURIComponent(printerId)}`;


    console.log("Xano sync URL:", url);

    const res = await fetch(url, {
      headers: {
        ...(xano.apiKey ? { Authorization: `Bearer ${xano.apiKey}` } : {}),
        // manche Xano Setups erwarten das Token auch als Header:
        "x-printer-id": printerId,
      },
      cache: "no-store",
    });

    const text = await res.text(); // erst text lesen für bessere logs
    if (!res.ok) {
      console.error("Xano response status:", res.status, text);
      return new NextResponse(
        `Xano fetch failed (${res.status}): ${text.slice(0, 300)}`,
        { status: 500 }
      );
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("Xano returned non-JSON:", text);
      return new NextResponse("Xano returned non-JSON response.", { status: 500 });
    }

    // Akzeptiere mehrere Formate:
    // 1) Array direkt
    // 2) { items: [...] }
    // 3) { data: [...] }
    const items =
      Array.isArray(json) ? json :
      Array.isArray(json?.items) ? json.items :
      Array.isArray(json?.data) ? json.data :
      null;

    if (!items) {
      console.error("Unexpected Xano JSON shape:", json);
      return new NextResponse("Xano response is not an array / items[] / data[].", { status: 500 });
    }

    await saveProducts({
      version: 1,
      items,
      meta: {
        source: "xano",
        lastUpdatedAt: new Date().toISOString(),
      },
    });

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

    return NextResponse.json({ ok: true, count: items.length });
  } catch (e: any) {
    console.error("POST /api/sync/xano-products failed:", e);
    return new NextResponse(`Sync failed: ${e?.message || "unknown error"}`, { status: 500 });
  }
}
