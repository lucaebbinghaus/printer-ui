import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import net from "net";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    console.log("---- PRINT API CALLED ----");

    // 🌐 HEADER LOGGEN
    console.log("HEADERS:", Object.fromEntries(req.headers));

    // 🔍 BODY EINLESEN & LOGGEN
    const body = await req.json();
    console.log("REQUEST BODY:", body);

    const { name, weight, art_number, mhd, qty = 1 } = body;

    if (!art_number || !name) {
      console.error("Missing required fields.");
      return new NextResponse("Missing fields (art_number, name)", { status: 400 });
    }

    // 📁 TEMPLATE SUCHEN + PFAD LOGGEN
    const base = process.cwd();
    const candidates = [
      path.join(base, "labels", "60x30.zpl")
    ];
    const templatePath = candidates.find((p) => fs.existsSync(p));

    console.log("TEMPLATE PATHS CHECKED:", candidates);
    console.log("USING TEMPLATE PATH:", templatePath);

    if (!templatePath) {
      return new NextResponse(
        `Template file not found.\nTried:\n${candidates.join("\n")}`,
        { status: 500 }
      );
    }

    // 📄 TEMPLATE LADEN & LOGGEN
    let zpl = fs.readFileSync(templatePath, "utf8");
    console.log("RAW TEMPLATE:\n", zpl);

    // 🧩 VARIABLEN ERSETZEN
    zpl = zpl
      .replaceAll("{{ART_NUMBER}}", String(art_number))
      .replaceAll("{{NAME}}", String(name))
      .replaceAll("{{WEIGHT}}", weight ? String(weight) : "")
      .replaceAll("{{MHD}}", mhd ? String(mhd) : "")
      .replaceAll("{{QTY}}", String(qty));

    console.log("FINAL ZPL TO SEND:\n", zpl);

    // 🖨 PRINTER SETTINGS
    const printerHost = "printer1.local";
    const port = 9100;
    console.log(`Sending to printer ${printerHost}:${port}`);

    // 🧵 SOCKET SENDEN
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

    return NextResponse.json({ ok: true, message: "Label printed" });
  } catch (e: any) {
    console.error("---- PRINT ERROR ----", e);
    return new NextResponse(e?.message ?? "Unknown error", { status: 500 });
  }
}
