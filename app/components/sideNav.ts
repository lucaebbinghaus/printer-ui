// app/components/sideNav.ts
import { readProducts, type Preset } from "@/app/lib/productsStore";

export type PrinterProduct = any;

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon?: string;
};

/**
 * Von /labels/[presetId]/page.tsx genutzt:
 * Liefert alle Presets aus products.json.
 */
export async function getProducts(): Promise<Preset[]> {
  const presets = await readProducts();
  console.log("[getProducts] presets:", presets.length);
  return presets;
}

/**
 * Von LeftSidebar genutzt:
 * Baut die Navigation (Labels / Status / Settings).
 */
export async function getSideNav(): Promise<{
  labels: NavItem[];
  status: NavItem[];
  settings: NavItem[];
}> {
  const presets: Preset[] = await readProducts();

  console.log("[getSideNav] presets gesamt:", presets.length);

  // WICHTIG:
  // Viele APIs haben kein "enabled"-Feld → dann wären alle weg.
  // Deshalb: alles anzeigen, außer wenn enabled explizit false ist.
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
      { key: "overview", label: "Drucker", href: "/status", icon: "Activity" },
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
