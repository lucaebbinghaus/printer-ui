import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import net from "net";

export async function POST(req: Request) {
  try {
    const { name, weight, art_number, mhd, qty = 1 } = await req.json();

    // Check required fields
    if (!art_number || !name) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    // 1) TEMPLATE LADEN
    const templatePath = path.join(process.cwd(), "labels", "60x30.zpl");
    let zpl = fs.readFileSync(templatePath, "utf8");

    // 2) VARIABLEN ERSETZEN
    zpl = zpl
      .replaceAll("{{ART_NUMBER}}", art_number)
      .replaceAll("{{NAME}}", name)
      .replaceAll("{{WEIGHT}}", weight || "")
      .replaceAll("{{MHD}}", mhd || "")
      .replaceAll("{{QTY}}", qty.toString());

    console.log("FINAL ZPL SENT:", zpl);

    // 3) TCP RAW SENDEN
    const printerHost = "printer1.local"; // oder IP: "192.168.x.x"
    const port = 9100;

    await new Promise((resolve, reject) => {
      const client = new net.Socket();

      client.connect(port, printerHost, () => {
        client.write(zpl, "utf8", () => {
          client.end();
          resolve(true);
        });
      });

      client.on("error", (err) => {
        reject(err);
      });
    });

    return NextResponse.json({ ok: true, message: "Label printed" });
  } catch (err: any) {
    console.error("PRINT ERROR:", err);
    return new NextResponse(err?.message || "Unknown error", { status: 500 });
  }
}
