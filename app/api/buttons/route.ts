import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const APP_DATA_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(APP_DATA_DIR, "products.json");

const DEFAULT_PRODUCTS = { items: [] }; // oder dein Default-Schema

export async function GET() {
  try {
    const raw = await fs.readFile(PRODUCTS_FILE, "utf-8");
    const json = JSON.parse(raw);
    return NextResponse.json(json.items ?? []);
  } catch (err: any) {
    // Wenn Datei fehlt: anlegen und leeres/default Ergebnis liefern
    if (err.code === "ENOENT") {
      await fs.mkdir(APP_DATA_DIR, { recursive: true });
      await fs.writeFile(PRODUCTS_FILE, JSON.stringify(DEFAULT_PRODUCTS, null, 2), "utf-8");
      return NextResponse.json(DEFAULT_PRODUCTS.items);
    }

    // Sonstige Fehler (kaputte JSON etc.)
    return NextResponse.json(
      { error: "Failed to load products.json" },
      { status: 500 }
    );
  }
}
