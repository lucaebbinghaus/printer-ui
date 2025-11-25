// app/lib/productsStore.ts
import fs from "fs/promises";
import path from "path";

export type PrinterProduct = any;

export type Preset = {
  id: number;
  created_at: number;
  name: string;
  product_ids: PrinterProduct[];
  enabled: boolean;
};

const DEFAULT_PRODUCTS = { items: [] as Preset[] };

// WICHTIG: APP_DATA_DIR IMMER GLEICH NUTZEN
const APP_DATA_DIR =
  process.env.APP_DATA_DIR || path.join(process.cwd(), "data");

const PRODUCTS_FILE = path.join(APP_DATA_DIR, "products.json");

async function ensureProductsFileExists() {
  await fs.mkdir(APP_DATA_DIR, { recursive: true });
  try {
    await fs.access(PRODUCTS_FILE);
  } catch {
    await fs.writeFile(
      PRODUCTS_FILE,
      JSON.stringify(DEFAULT_PRODUCTS, null, 2),
      "utf-8"
    );
  }
}

export async function readProducts(): Promise<Preset[]> {
  try {
    await ensureProductsFileExists();
    console.log("[readProducts] FILE:", PRODUCTS_FILE);

    const raw = await fs.readFile(PRODUCTS_FILE, "utf-8");
    const json = JSON.parse(raw);
    if (!json || !Array.isArray(json.items)) {
      console.warn("[readProducts] Invalid format, returning []");
      return [];
    }
    console.log("[readProducts] count:", json.items.length);
    return json.items as Preset[];
  } catch (err) {
    console.error("[readProducts] ERROR:", err);
    return [];
  }
}

export async function writeProducts(items: Preset[]): Promise<void> {
  await ensureProductsFileExists();
  const payload = { items };
  console.log("[writeProducts] Writing", items.length, "items to", PRODUCTS_FILE);
  await fs.writeFile(PRODUCTS_FILE, JSON.stringify(payload, null, 2), "utf-8");
}
