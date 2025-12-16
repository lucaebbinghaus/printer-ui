// app/lib/productsStore.ts
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type Preset = any; // bleibt flexibel; falls du ein Preset-Interface hast, hier ersetzen

// Wichtig: Daten immer im gemounteten /data Volume speichern (wenn gesetzt)
const APP_DATA_DIR = process.env.APP_DATA_DIR?.trim();
const DATA_DIR = APP_DATA_DIR ? APP_DATA_DIR : path.join(process.cwd(), "data");

export const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export function stableStringify(value: any): string {
  // Stabiler JSON-String: sortiert Object-Keys rekursiv
  const seen = new WeakSet();

  const normalize = (v: any): any => {
    if (v === null || typeof v !== "object") return v;

    if (seen.has(v)) return v; // Zyklen ignorieren (sollte nicht vorkommen)
    seen.add(v);

    if (Array.isArray(v)) return v.map(normalize);

    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = normalize(v[k]);
    return out;
  };

  return JSON.stringify(normalize(value));
}

export function computeProductsHash(items: Preset[]): string {
  const s = stableStringify(items);
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function readProducts(): Promise<Preset[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(PRODUCTS_FILE, "utf8");
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : [];
  } catch (e: any) {
    if (e?.code === "ENOENT") return [];
    throw e;
  }
}

export async function writeProducts(items: Preset[]): Promise<void> {
  await ensureDataDir();
  const payload = JSON.stringify(items, null, 2);
  await fs.writeFile(PRODUCTS_FILE, payload, "utf8");
}
