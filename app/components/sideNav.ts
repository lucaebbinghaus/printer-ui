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
 * Wird von z.B. /labels/[presetId]/page.tsx importiert.
 * Liefert alle Presets aus products.json.
 */
export async function getProducts(): Promise<Preset[]> {
  const presets = await readProducts();
  console.log("[getProducts] presets:", presets.length);
  return presets;
}

/**
 * Wird von LeftSidebar benutzt, um die Navigation zu bauen.
 */
export async function getSideNav(): Promise<{
  labels: NavItem[];
  status: NavItem[];
  settings: NavItem[];
}> {
  const presets: Preset[] = await readProducts();

  console.log("[getSideNav] presets:", presets.length);

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
