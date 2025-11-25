// components/sideNav.ts (Server)
import fs from "fs/promises";
import path from "path";

export type PrinterProduct = any; // ButtonCard/ ButtonGrid Typ bleibt bei dir

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
  icon?: string; // STRING wegen RSC
};

const APP_DATA_DIR =
  process.env.APP_DATA_DIR || path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(APP_DATA_DIR, "products.json");

const DEFAULT_PRODUCTS = { items: [] as Preset[] };

export async function getProducts(): Promise<Preset[]> {
  try {
    const raw = await fs.readFile(PRODUCTS_FILE, "utf-8");
    const json = JSON.parse(raw);
    return json.items ?? [];
  } catch (err: any) {
    if (err.code === "ENOENT") {
      await fs.mkdir(APP_DATA_DIR, { recursive: true });
      await fs.writeFile(
        PRODUCTS_FILE,
        JSON.stringify(DEFAULT_PRODUCTS, null, 2),
        "utf-8"
      );
      return DEFAULT_PRODUCTS.items;
    }
    return [];
  }
}

export async function getSideNav(): Promise<{
  labels: NavItem[];
  status: NavItem[];
  settings: NavItem[];
}> {
  const presets = await getProducts();
  console.log("SideNav presets", presets.length); // nur zum Testen

  const labels: NavItem[] = presets
    .filter(p => p.enabled) // nur aktive Presets
    .map((p) => ({
      key: String(p.id),
      label: p.name,
      href: `/labels/${p.id}`, // wichtig: Section = labels
      icon: "Tag",
    }));

  return {
    labels,
    status: [
      { key: "overview", label: "Drucker", href: "/status", icon: "Activity" }
    ],
    settings: [
      { key: "general", label: "Allgemein", href: "/settings", icon: "Sliders" },
      { key: "network", label: "Netzwerk", href: "/settings/network", icon: "Wrench" },
      { key: "sync", label: "Sync", href: "/settings/sync", icon: "RefreshCcw" },
    ],
  };
}
