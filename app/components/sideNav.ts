// app/components/sideNav.ts
import { unstable_noStore as noStore } from "next/cache";
import { getProducts as getProductsFile } from "@/app/lib/storage";

export type PrinterProduct = any;

// Preset bleibt flexibel (Xano-Shape)
export type Preset = any;

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon?: string;
};

/**
 * Liefert alle Presets aus products.json (storage.ts Schema).
 * Unterstützt zusätzlich Legacy-Form (Array) falls vorhanden.
 */
export async function getProducts(): Promise<Preset[]> {
  noStore();

  const file: any = await getProductsFile<Preset>([]);
  // Neu: { version, items, meta }
  if (file && Array.isArray(file.items)) {
    console.log("[getProducts] presets(items):", file.items.length);
    return file.items;
  }

  // Legacy: direktes Array
  if (Array.isArray(file)) {
    console.log("[getProducts] presets(array):", file.length);
    return file;
  }

  console.log("[getProducts] presets: 0 (unexpected shape)");
  return [];
}

/**
 * Baut die Navigation für die Sidebar (Labels / Status / Settings).
 * Liest immer live aus products.json.
 */
export async function getSideNav(): Promise<{
  labels: NavItem[];
  status: NavItem[];
  settings: NavItem[];
}> {
  noStore();

  const presets: Preset[] = await getProducts();

  console.log("[getSideNav] presets gesamt:", presets.length);

  // Filter: Nur ausblenden, wenn enabled == false (Default: zeigen)
  const enabledPresets = presets.filter((p) => (p as any)?.enabled !== false);

  console.log("[getSideNav] presets nach Filter:", enabledPresets.length);

  const labels: NavItem[] = enabledPresets.map((p) => ({
    key: String((p as any).id),
    label: String((p as any).name ?? (p as any).id ?? "Preset"),
    href: `/labels/${(p as any).id}`,
    icon: "Tag",
  }));

  return {
    labels,
    status: [
      { key: "general", label: "Allgemein", href: "/status", icon: "Sliders" },
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
      {
        key: "backups",
        label: "Backups",
        href: "/settings/backups",
        icon: "RotateCcw",
      },
      {
        key: "update",
        label: "Update",
        href: "/settings/update",
        icon: "DownloadCloud",
      },
    ],
  };
}
