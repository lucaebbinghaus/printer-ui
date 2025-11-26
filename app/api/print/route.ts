import { NextResponse } from "next/server";
import { getConfig } from "@/app/lib/storage";
import { buildLabelHtml } from "@/app/lib/buildLabelHtml";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    console.log("---- PRINT API CALLED ----");

    const body = await req.json();
    console.log("REQUEST BODY:", body);

    const {
      html = "",         // Zutaten-Richtext aus deinem Frontend (buildIngredientsHtml)
      name,
      weight,
      art_number,
      mhd,
      qty,
      description,
    } = body;

    if (!art_number || !name) {
      return new NextResponse("Missing fields (art_number, name)", { status: 400 });
    }

    const config = await getConfig();

    // Menge wie bisher aus config/general
    const configDefaultQty = Number(config.general?.defaultLabelQty ?? 1);
    const finalQtyRaw =
      qty !== undefined && qty !== null ? qty : configDefaultQty;
    const finalQty = Math.max(1, Number(finalQtyRaw) || 1);

    // Drucker-IP aus config
    const printerHost =
      (config.network?.printerIp || "").trim() || "printer1.local";
    const tcpAddress = `${printerHost}:9100`;

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
    });

    const dataBase64 = Buffer.from(labelHtml, "utf8").toString("base64");

    const zplboxUrl = process.env.ZPLBOX_URL ?? "http://localhost:8080";

    // Variante: HTML -> ZPL -> direkt zum Drucker
    const res = await fetch(
      `${zplboxUrl}/v1/html2zpl/print/${encodeURIComponent(tcpAddress)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widthPts: 945,
          heightPts: 800,
          orientation: "Rotate90",
          dataBase64,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("ZPLBOX ERROR:", res.status, text);
      return new NextResponse(`ZplBox error: ${res.status} ${text}`, {
        status: 502,
      });
    }

    console.log("---- PRINT SUCCESS (via ZplBox) ----");
    return NextResponse.json({
      ok: true,
      message: `Label printed (${finalQty}x) via ZplBox`,
    });
  } catch (e: any) {
    console.error("---- PRINT ERROR ----", e);
    return new NextResponse(e?.message ?? "Unknown error", { status: 500 });
  }
}
