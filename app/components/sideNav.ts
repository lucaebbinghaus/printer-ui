// app/components/sideNav.ts (Pfad bei dir anpassen)
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

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon?: string;
};

// WICHTIG: APP_DATA_DIR sollte im Docker auf denselben Pfad zeigen,
// den du gemountet hast, z.B. /data
// docker run ... -e APP_DATA_DIR=/data -v /pfad/auf/pi:/data ...
const APP_DATA_DIR =
  process.env.APP_DATA_DIR || path.join(process.cwd(), "data");

const PRODUCTS_FILE = path.join(APP_DATA_DIR, "products.json");

const DEFAULT_PRODUCTS = { items: [] as Preset[] };

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

export async function getProducts(): Promise<Preset[]> {
  try {
    await ensureProductsFileExists();

    const raw = await fs.readFile(PRODUCTS_FILE, "utf-8");
    const json = JSON.parse(raw);

    if (!json || !Array.isArray(json.items)) {
      console.warn(
        "[getProducts] products.json hat kein gültiges Format, fallback auf []"
      );
      return [];
    }

    return json.items as Preset[];
  } catch (err: any) {
    console.error("[getProducts] Fehler beim Lesen von products.json:", err);
    // lieber Fehler sehen, statt still [] zurückzugeben
    return [];
  }
}

export async function getSideNav(): Promise<{
  labels: NavItem[];
  status: NavItem[];
  settings: NavItem[];
}> {
  const presets = await getProducts();

  console.log(
    "[getSideNav] Anzahl Presets:",
    presets.length,
    "APP_DATA_DIR:",
    APP_DATA_DIR
  );

  const labels: NavItem[] = presets
    .filter((p) => p.enabled)
    .map((p) => ({
      key: String(p.id),
      label: p.name,
      href: `/labels/${p.id}`,
      icon: "Tag",
    }));

  return {
    labels,
    status: [
      {
        key: "overview",
        label: "Drucker",
        href: "/status",
        icon: "Activity",
      },
    ],
    settings: [
      { key: "general", label: "Allgemein", href: "/settings", icon: "Sliders" },
      {
        key: "network",
        label: "Netzwerk",
        href: "/settings/network",
        icon: "Wrench",
      },
      {
        key: "sync",
        label: "Sync",
        href: "/settings/sync",
        icon: "RefreshCcw",
      },
    ],
  };
}
