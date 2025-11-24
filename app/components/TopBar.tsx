"use client";

import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { ArrowLeft, Maximize2 } from "lucide-react";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="w-full bg-[#efefef] border-b border-gray-200">
      <div className="mx-auto flex h-14 items-center justify-between px-4">

        {/* LEFT: Back + Tabs in one continuous pill bar */}
        <div className="flex items-center">

          {/* Shared container with white background */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

            {/*
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.98] border-r border-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            */}

            {/* Tabs */}
            <nav className="flex items-center">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                const Icon = (item as any).icon as
                  | React.ComponentType<{ className?: string }>
                  | undefined;

                return (
                  <button
                    key={item.key}
                    onClick={() => router.push(item.href)}
                    className={[
                      "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-l border-gray-200",
                      active
                        ? "bg-gray-900 text-white"
                        : "text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {item.label}
                  </button>
                );
              })}
            </nav>

          </div>
        </div>

        {/* RIGHT: Fullscreen button */}
        <button
          aria-label="Fullscreen"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
          onClick={() => {
            const el = document.documentElement;
            if (!document.fullscreenElement) el.requestFullscreen?.();
            else document.exitFullscreen?.();
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </button>

      </div>
    </header>
  );
}
