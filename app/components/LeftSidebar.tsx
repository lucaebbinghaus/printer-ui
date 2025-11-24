"use client";

import { usePathname, useRouter } from "next/navigation";
import { SIDE_NAV } from "./sideNav";

export default function LeftSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // 1. Segment bestimmen: /labels/xyz -> "labels"
  const section = pathname.split("/")[1] || "";
  const items = SIDE_NAV[section] ?? [];

  if (!items.length) return null; // wenn kein SideNav für die Section existiert

  return (
    <aside className="w-56 shrink-0 px-3 py-4 bg-[#efefef]">
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              onClick={() => router.push(item.href)}
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition text-left",
                active
                  ? "bg-white border-gray-300 text-gray-900"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
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
