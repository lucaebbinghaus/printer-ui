"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tag, Activity, Cpu, Wrench, Sliders, RefreshCcw } from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Tag,
  Activity,
  Cpu,
  Wrench,
  Sliders,
  RefreshCcw,
};

const UNLOCK_KEY = "settingsUnlockUntil";

function isUnlockedNow() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    const until = raw ? Number(raw) : 0;
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export default function ClientLeftSidebar({ sideNav }: { sideNav: any }) {
  const pathname = usePathname();
  const router = useRouter();

  const section = pathname.split("/")[1] || "";
  const rawItems = sideNav?.[section] ?? [];

  const [unlocked, setUnlocked] = useState(false);

  // Live-Update wenn General-Page "freischaltet"
  useEffect(() => {
    const update = () => setUnlocked(isUnlockedNow());

    update();

    const onStorage = (e: StorageEvent) => {
      if (e.key === UNLOCK_KEY) update();
    };

    const onCustom = () => update();

    window.addEventListener("storage", onStorage);
    window.addEventListener("settings-unlock-changed", onCustom as any);

    // optional: alle 2s prüfen (falls Ablauf während der Session)
    const t = setInterval(update, 2000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("settings-unlock-changed", onCustom as any);
      clearInterval(t);
    };
  }, []);

  const items = useMemo(() => {
    // Nur im Settings-Bereich verstecken wir Network/Sync, bis freigeschaltet
    if (section !== "settings") return rawItems;

    if (unlocked) return rawItems;

    // nur "Allgemein" anzeigen
    return rawItems.filter((i: any) => i?.href === "/settings");
  }, [rawItems, section, unlocked]);

  // Longest-match active (damit /settings nicht bei /settings/network aktiv bleibt)
  const activeHref = useMemo(() => {
    const matches = items.filter(
      (item: any) =>
        pathname === item.href || pathname.startsWith(item.href + "/")
    );
    if (matches.length === 0) return "";
    matches.sort((a: any, b: any) => String(b.href).length - String(a.href).length);
    return matches[0].href;
  }, [items, pathname]);

  if (!items.length) return null;

  return (
    <aside className="w-56 shrink-0 px-3 py-4 bg-[#efefef]">
      <div className="flex flex-col gap-2">
        {items.map((item: any) => {
          const active = item.href === activeHref;
          const Icon = item.icon ? ICON_MAP[item.icon] : null;

          return (
            <button
              key={item.key}
              onClick={() => router.push(item.href)}
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition text-left",
                active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
