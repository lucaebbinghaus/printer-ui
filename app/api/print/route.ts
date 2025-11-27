import { NextResponse } from "next/server";
import net from "net";
import { getConfig } from "@/app/lib/storage";
import { buildLabelHtml } from "@/app/lib/buildLabelHtml";

export const runtime = "nodejs";

type SendZplOptions = {
  host: string;
  port: number;
  zpl: string;
  copies: number;
};

/**
 * Fügt ein ^PQn nach ^XA in das ZPL ein, um die Anzahl der Etiketten
 * druckerintern zu steuern.
 */
function injectQuantity(zpl: string, quantity: number): string {
  if (quantity <= 1) return zpl;

  const idx = zpl.indexOf("^XA");
  if (idx === -1) {
    // keine ^XA gefunden → ZPL nicht anfassen, um nichts zu zerschießen
    return zpl;
  }

  const insertPos = idx + 3; // direkt nach ^XA
  const pqCommand = `^PQ${quantity}\n`;

  return zpl.slice(0, insertPos) + pqCommand + zpl.slice(insertPos);
}

/**
 * Sendet ZPL direkt per TCP an den Drucker.
 * Nutzt entweder ^PQ oder kann alternativ ZPL mehrfach senden.
 */
async function sendZplToPrinter({
  host,
  port,
  zpl,
  copies,
}: SendZplOptions): Promise<void> {
  const copiesSafe = Math.max(1, Number(copies) || 1);

  // Variante A: ^PQ in das ZPL injizieren
  const zplWithQuantity = injectQuantity(zpl, copiesSafe);

  // Variante B (Fallback, wenn ^PQ zickt):
  // let payload = "";
  // for (let i = 0; i < copiesSafe; i++) {
  //   payload += zpl;
  // }
  // const zplWithQuantity = payload;

  console.log(
    `[PRINT] sending to printer ${host}:${port} with copies=${copiesSafe}`
  );

  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(zplWithQuantity, "ascii", () => {
        socket.end();
      });
    });

    socket.on("error", (err) => {
      console.error("[PRINT] TCP error:", err);
      reject(err);
    });

    socket.on("end", () => {
      console.log("[PRINT] TCP connection closed by printer");
      resolve();
    });
  });
}

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
      html = "", // Zutaten-Richtext
      name,
      weight,
      art_number,
      mhd,
      qty, // optionale Menge aus dem Request
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

    // Menge:
    // - wenn qty im Body gesetzt → diese verwenden
    // - sonst general.defaultLabelQty aus der Config
    const configDefaultQty = Number(config.general?.defaultLabelQty ?? 1);
    const finalQtyRaw =
      qty !== undefined && qty !== null ? qty : configDefaultQty;
    const finalQty = Math.max(1, Number(finalQtyRaw) || 1);

    console.log("[PRINT] finalQty:", finalQty);

    // Drucker-IP aus config
    const printerHost = (config.network?.printerIp || "").trim();
    const printerPort = 9100;

    if (!printerHost) {
      console.error("[PRINT] No printerHost configured");
      return new NextResponse("Printer IP not configured", { status: 500 });
    }

    console.log("[PRINT] printerHost:", printerHost);
    console.log("[PRINT] printerPort:", printerPort);

    // Barcode-Daten (hier erstmal einfach Art.-Nr.)
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

    // Nur Render-Endpoint (kein /print)
    const zplboxEndpoint = `${zplboxUrl}/v1/html2zpl`;
    console.log("[PRINT] ZplBox endpoint (render-only):", zplboxEndpoint);

    const tBeforeFetch = Date.now();
    console.log("[PRINT] before fetch to ZplBox:", tBeforeFetch - t0, "ms");

    // HTML -> ZPL (nur Rendern)
    const renderRes = await fetch(zplboxEndpoint, {
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
      "[PRINT] fetch duration (ZplBox render):",
      tAfterFetch - tBeforeFetch,
      "ms"
    );

    if (!renderRes.ok) {
      const text = await renderRes.text().catch(() => "<no body>");
      console.error("ZPLBOX RENDER ERROR:", renderRes.status, text);
      return new NextResponse(
        `ZplBox render error: ${renderRes.status} ${text}`,
        { status: 502 }
      );
    }

    const zplCode = await renderRes.text();
    console.log("[PRINT] received ZPL length:", zplCode.length);

    // ZPL direkt an den Drucker schicken (mit Quantity)
    const tBeforeSend = Date.now();
    await sendZplToPrinter({
      host: printerHost,
      port: printerPort,
      zpl: zplCode,
      copies: finalQty,
    });
    const tAfterSend = Date.now();
    console.log(
      "[PRINT] TCP send duration (printer):",
      tAfterSend - tBeforeSend,
      "ms"
    );

    console.log(
      "---- PRINT SUCCESS (render+TCP) ---- total:",
      Date.now() - t0,
      "ms"
    );

    return NextResponse.json({
      ok: true,
      message: `Label printed (${finalQty}x) via direct TCP`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    console.error(
      "---- PRINT ERROR (render+TCP) ---- after",
      Date.now() - t0,
      "ms",
      e
    );
    return new NextResponse(e?.message ?? "Unknown error", { status: 500 });
  }
}
