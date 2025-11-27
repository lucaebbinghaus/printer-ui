import { NextResponse } from "next/server";
import { getConfig } from "@/app/lib/storage";
import { buildLabelHtml } from "@/app/lib/buildLabelHtml";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const t0 = Date.now();
  console.log("---- PRINT API CALLED ----", new Date().toISOString());

  try {
    console.log("[PRINT] t+0ms: start");

    const body = await req.json();
    const tAfterJson = Date.now();
    console.log("[PRINT] after req.json:", tAfterJson - t0, "ms");
    console.log("[PRINT] REQUEST BODY:", body);

    const {
      html = "", // Zutaten-Richtext aus deinem Frontend (buildIngredientsHtml)
      name,
      weight,
      art_number,
      mhd,
      qty,
      description,
      dietTypeSvg,
    } = body;

    if (!art_number || !name) {
      console.warn("[PRINT] Missing fields (art_number, name)");
      return new NextResponse("Missing fields (art_number, name)", {
        status: 400,
      });
    }

    const config = await getConfig();
    const tAfterConfig = Date.now();
    console.log("[PRINT] after getConfig:", tAfterConfig - t0, "ms");

    // Menge wie bisher aus config/general
    const configDefaultQty = Number(config.general?.defaultLabelQty ?? 1);
    const finalQtyRaw =
      qty !== undefined && qty !== null ? qty : configDefaultQty;
    const finalQty = Math.max(1, Number(finalQtyRaw) || 1);

    // Drucker-IP aus config
    const printerHost = (config.network?.printerIp || "").trim();
    const tcpAddress = `${printerHost}:9100`;

    console.log("[PRINT] printerHost:", printerHost);
    console.log("[PRINT] tcpAddress:", tcpAddress);

    // Barcode-Data festlegen (hier erstmal einfach Art.-Nr.; GS1-Logik kannst du später verfeinern)
    const barcodeData = String(art_number);

    // HTML-Label bauen
    const labelHtml = buildLabelHtml({
      name,
      artNumber: String(art_number),
      weight: String(weight ?? ""),
      mhd: String(mhd ?? ""),
      ingredientsHtml: html,
      barcodeData,
      description,
      dietTypeSvg,
    });

    const tAfterHtml = Date.now();
    console.log("[PRINT] after buildLabelHtml:", tAfterHtml - t0, "ms");

    const dataBase64 = Buffer.from(labelHtml, "utf8").toString("base64");

    const zplboxUrl = process.env.ZPLBOX_URL ?? "http://zplbox:8080";
    console.log("[PRINT] ZPLBOX_URL:", zplboxUrl);

    const zplboxEndpoint = `${zplboxUrl}/v1/html2zpl/print/${encodeURIComponent(
      tcpAddress
    )}`;
    console.log("[PRINT] ZplBox endpoint:", zplboxEndpoint);

    const tBeforeFetch = Date.now();
    console.log("[PRINT] before fetch to ZplBox:", tBeforeFetch - t0, "ms");

    // Variante: HTML -> ZPL -> direkt zum Drucker
    const res = await fetch(zplboxEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        widthPts: 685,
        heightPts: 1010,
        orientation: "Rotate0",
        dataBase64,
      }),
    });

    const tAfterFetch = Date.now();
    console.log("[PRINT] after fetch to ZplBox:", tAfterFetch - t0, "ms");
    console.log(
      "[PRINT] fetch duration:",
      tAfterFetch - tBeforeFetch,
      "ms (ZplBox + Drucker)"
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      console.error("ZPLBOX ERROR:", res.status, text);
      return new NextResponse(`ZplBox error: ${res.status} ${text}`, {
        status: 502,
      });
    }

    console.log(
      "---- PRINT SUCCESS (via ZplBox) ---- total:",
      Date.now() - t0,
      "ms"
    );
    return NextResponse.json({
      ok: true,
      message: `Label printed (${finalQty}x) via ZplBox`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    console.error(
      "---- PRINT ERROR ---- after",
      Date.now() - t0,
      "ms",
      e
    );
    return new NextResponse(e?.message ?? "Unknown error", { status: 500 });
  }
}
