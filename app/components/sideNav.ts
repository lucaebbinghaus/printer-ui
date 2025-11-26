// app/components/sideNav.ts
import { unstable_noStore as noStore } from "next/cache";
import { readProducts, type Preset } from "@/app/lib/productsStore";

export type PrinterProduct = any;

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon?: string;
};

/**
 * Liefert alle Presets aus products.json.
 */
export async function getProducts(): Promise<Preset[]> {
  noStore(); // Wichtig: niemals cachen!
  const presets = await readProducts();
  console.log("[getProducts] presets:", presets.length);
  return presets;
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
  noStore(); // WICHTIG: verhindert Next.js Static Rendering / Caching

  const presets: Preset[] = await readProducts();

  console.log("[getSideNav] presets gesamt:", presets.length);

  // Filter: Nur ausblenden, wenn enabled == false (Default: zeigen)
  const enabledPresets = presets.filter((p) => (p as any).enabled !== false);

  console.log("[getSideNav] presets nach Filter:", enabledPresets.length);

  const labels: NavItem[] = enabledPresets.map((p) => ({
    key: String(p.id),
    label: p.name,
    href: `/labels/${p.id}`,
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
    ],
  };
}
