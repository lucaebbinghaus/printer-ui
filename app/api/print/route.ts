import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import net from "net";
import { getConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

// -------- HTML -> Plaintext Helpers --------
function decodeHtmlEntities(str: string) {
  return str
    .replaceAll("&uuml;", "ü")
    .replaceAll("&ouml;", "ö")
    .replaceAll("&auml;", "ä")
    .replaceAll("&Uuml;", "Ü")
    .replaceAll("&Ouml;", "Ö")
    .replaceAll("&Auml;", "Ä")
    .replaceAll("&szlig;", "ß")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function htmlToPlainText(html: string) {
  if (!html) return "";

  let text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n");

  text = text.replace(/<[^>]+>/g, ""); // tags raus
  text = decodeHtmlEntities(text);
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s+\n/g, "\n").trim();

  return text;
}

// ------------------------------------------

export async function POST(req: Request) {
  try {
    console.log("---- PRINT API CALLED ----");
    console.log("HEADERS:", Object.fromEntries(req.headers));

    const body = await req.json();
    console.log("REQUEST BODY:", body);

    const {
      html = "",
      name,
      weight,
      art_number,
      mhd,
      qty, // optional – Config übernimmt Default
    } = body;

    const ingredientsText = htmlToPlainText(html);

    if (!art_number || !name) {
      console.error("Missing required fields.");
      return new NextResponse("Missing fields (art_number, name)", {
        status: 400,
      });
    }

    // CONFIG LADEN
    const config = await getConfig();

    // Default-Menge aus Config (general.defaultLabelQty)
    const configDefaultQty = Number(config.general?.defaultLabelQty ?? 1);

    // finale Menge: Request > Config > 1
    const finalQtyRaw =
      qty !== undefined && qty !== null ? qty : configDefaultQty;

    const finalQty = Math.max(1, Number(finalQtyRaw) || 1);

    // TEMPLATE SUCHEN
    const base = process.cwd();
    const candidates = [path.join(base, "app", "labels", "60x30.zpl")];
    const templatePath = candidates.find((p) => fs.existsSync(p));

    console.log("TEMPLATE PATHS CHECKED:", candidates);
    console.log("USING TEMPLATE PATH:", templatePath);

    if (!templatePath) {
      return new NextResponse(
        `Template file not found.\nTried:\n${candidates.join("\n")}`,
        { status: 500 }
      );
    }

    // TEMPLATE LADEN
    let zpl = fs.readFileSync(templatePath, "utf8");

    // VARIABLEN ERSETZEN (Textfelder)
    zpl = zpl
      .replaceAll("{{ART_NUMBER}}", String(art_number))
      .replaceAll("{{NAME}}", String(name))
      .replaceAll("{{WEIGHT}}", weight ? String(weight) : "")
      .replaceAll("{{MHD}}", mhd ? String(mhd) : "")
      .replaceAll("{{QTY}}", String(finalQty)) // falls du Menge auf dem Label anzeigen willst
      .replaceAll("{{INGREDIENTS}}", ingredientsText);

    // ZPL-Printmenge (^PQ) einsetzen, falls Platzhalter vorhanden
    if (zpl.includes("{{PQ}}")) {
      const pqCmd = `^PQ${finalQty},0,1,Y`;
      zpl = zpl.replaceAll("{{PQ}}", pqCmd);
    }

    // wichtig gegen leeres Label durch trailing whitespace
    zpl = zpl.trimEnd();

    console.log("FINAL ZPL TO SEND:\n", zpl);

    // PRINTER SETTINGS aus config.json
    const printerHost =
      (config.network?.printerIp || "").trim() || "printer1.local";

    const port = 9100;

    console.log(`Sending to printer ${printerHost}:${port}`);

    // TCP SENDEN
    await new Promise<void>((resolve, reject) => {
      const client = new net.Socket();

      client.connect(port, printerHost, () => {
        console.log("TCP CONNECTED");
        client.write(zpl, "utf8", () => {
          console.log("TCP WRITE DONE");
          client.end();
          resolve();
        });
      });

      client.on("error", (err) => {
        console.error("TCP ERROR:", err);
        reject(err);
      });

      client.on("close", () => {
        console.log("TCP CONNECTION CLOSED");
      });
    });

    console.log("---- PRINT SUCCESS ----");
    return NextResponse.json({
      ok: true,
      message: `Label printed (${finalQty}x via ^PQ)`,
    });
  } catch (e: any) {
    console.error("---- PRINT ERROR ----", e);
    return new NextResponse(e?.message ?? "Unknown error", { status: 500 });
  }
}