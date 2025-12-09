// app/api/print/route.ts

import { NextResponse } from "next/server";
import net from "net";
import { getConfig } from "@/app/lib/storage";
import { buildLabelHtml } from "@/app/lib/buildLabelHtml";
import {
  buildIngredientsFromProduct,
  XanoProduct,
} from "@/app/lib/xanoIngredients";

export const runtime = "nodejs";

type SendZplOptions = {
  host: string;
  port: number;
  zpl: string;
  copies: number;
};

function injectQuantity(zpl: string, quantity: number): string {
  if (quantity <= 1) return zpl;

  const idx = zpl.indexOf("^XA");
  if (idx === -1) {
    return zpl;
  }

  const insertPos = idx + 3;
  const pqCommand = `^PQ${quantity}\n`;

  return zpl.slice(0, insertPos) + pqCommand + zpl.slice(insertPos);
}

async function sendZplToPrinter({
  host,
  port,
  zpl,
  copies,
}: SendZplOptions): Promise<void> {
  const copiesSafe = Math.max(1, Number(copies) || 1);
  const zplWithQuantity = injectQuantity(zpl, copiesSafe);

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
    const body = await req.json();
    console.log("[PRINT] REQUEST BODY:", body);

    let {
      html = "",
      name,
      weight,
      art_number,
      mhd,
      mhd_days,
      qty,
      description,
      dietTypeSvg,
      product,
    } = body as {
      html?: string;
      name?: string;
      weight?: string;
      art_number?: string | number;
      mhd?: string;
      mhd_days?: number;
      qty?: number;
      description?: string;
      dietTypeSvg?: string | null;
      product?: XanoProduct; // Mindest-Typ (Name + Komponenten)
    };

    let ingredientsHtml = html;

    // Wenn ein Produkt mit Komponenten/Ingredients übergeben wurde,
    // alles serverseitig berechnen.
    if (product && Array.isArray(product.printer_components_ids)) {
      const res = buildIngredientsFromProduct(product);
      ingredientsHtml = res.ingredientsHtml;

      // Für zusätzliche Felder casten wir auf any,
      // weil sie nicht im minimalen XanoProduct-Typ stehen.
      const productAny = product as any;

      if (!name) name = product.name;

      if (art_number === undefined || art_number === null) {
        art_number = productAny.art_number;
      }

      if (!weight && productAny.weight !== undefined) {
        weight = `${productAny.weight}g`;
      }

      if (!description && productAny.description) {
        description = productAny.description;
      }

      if (!dietTypeSvg && productAny._addon_printer_product_diet_type?.svg) {
        dietTypeSvg = productAny._addon_printer_product_diet_type.svg;
      }

      if (!mhd && productAny.mhd !== undefined && productAny.mhd !== null) {
        mhd = String(productAny.mhd);
      }
    }

    const artNumberStr = String(art_number ?? "").trim();

    if (!artNumberStr || !name) {
      console.warn("[PRINT] Missing fields (art_number, name)");
      return new NextResponse("Missing fields (art_number, name)", {
        status: 400,
      });
    }

    const config = await getConfig();

    const configDefaultQty = Number(config.general?.defaultLabelQty ?? 1);
    const finalQtyRaw =
      qty !== undefined && qty !== null ? qty : configDefaultQty;
    const finalQty = Math.max(1, Number(finalQtyRaw) || 1);

    const printerHost = (config.network?.printerIp || "").trim();
    const printerPort = 9100;

    if (!printerHost) {
      console.error("[PRINT] No printerHost configured");
      return new NextResponse("Printer IP not configured", { status: 500 });
    }

    const barcodeData = artNumberStr;

    const labelHtml = buildLabelHtml({
      name,
      artNumber: artNumberStr,
      weight: String(weight ?? ""),
      mhd: String(mhd ?? ""),
      ingredientsHtml: ingredientsHtml || "",
      barcodeData,
      description: description ?? "",
      dietTypeSvg: dietTypeSvg ?? undefined,
    });

    const dataBase64 = Buffer.from(labelHtml, "utf8").toString("base64");

    const zplboxUrl = process.env.ZPLBOX_URL ?? "http://zplbox:8080";
    const zplboxEndpoint = `${zplboxUrl}/v1/html2zpl`;

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

    await sendZplToPrinter({
      host: printerHost,
      port: printerPort,
      zpl: zplCode,
      copies: finalQty,
    });

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
