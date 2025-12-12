"use client";

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

function isMatch(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function getActiveHref(pathname: string, items: any[]) {
  const matches = items.filter((item) => item?.href && isMatch(pathname, item.href));
  if (matches.length === 0) return "";

  // Längster href gewinnt (z. B. /settings/network vor /settings)
  matches.sort((a, b) => String(b.href).length - String(a.href).length);
  return matches[0].href;
}

export default function ClientLeftSidebar({ sideNav }: { sideNav: any }) {
  const pathname = usePathname();
  const router = useRouter();

  const section = pathname.split("/")[1] || "";
  const items = sideNav?.[section] ?? [];

  if (!items.length) return null;

  const activeHref = getActiveHref(pathname, items);

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
