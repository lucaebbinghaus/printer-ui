// components/TopBar.tsx
"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { RotateCcw, OctagonX } from "lucide-react";
import type { LampStatus } from "@/app/lib/opcuaWatcher";
import { usePrinterStatus } from "@/app/lib/usePrinterStatus";

function StatusDot({ status }: { status: LampStatus }) {
  const map: Record<LampStatus, string> = {
    ok: "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]",
    warning: "bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.6)]",
    error: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
    unknown: "bg-gray-400",
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[status]}`} />
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  const {
    overallStatus,
    connected,
    isReady,
    isActive,
    labelsRemaining,
    errorText,
  } = usePrinterStatus();

  const [cancelling, setCancelling] = useState(false);
  const [tempMessage, setTempMessage] = useState<string | null>(null);

  async function handleCancelJobs() {
    setCancelling(true);
    try {
      const res = await fetch("/api/print/cancel", {
        method: "POST",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Abbruch fehlgeschlagen");
      }
      const json = await res.json();
      console.log("Cancel result:", json);

      setTempMessage("Alle Druckjobs wurden abgebrochen.");
      setTimeout(() => setTempMessage(null), 4000);
    } catch (e) {
      console.error(e);
      setTempMessage("Fehler beim Abbrechen der Jobs.");
      setTimeout(() => setTempMessage(null), 4000);
    } finally {
      setCancelling(false);
    }
  }

  // zweite Zeile im Chip
  const secondaryLine = (() => {
    if (tempMessage) return tempMessage;
    if (!connected) return "Keine Verbindung zum Drucker.";
    if (errorText) return `Fehler: ${errorText}`;
    if (!isReady) return "Drucker nicht bereit.";
    if (isActive) {
      if (typeof labelsRemaining === "number") {
        return `Druck läuft – noch ${labelsRemaining} Etikett${
          labelsRemaining === 1 ? "" : "en"
        }`;
      }
      return "Druck läuft …";
    }
    return "Bereit für neuen Druckauftrag.";
  })();

  // erste Zeile (kurz)
  const primaryLine = (() => {
    if (!connected) return "Drucker nicht verbunden";
    if (!isReady) return "Drucker nicht bereit";
    return "Drucker bereit";
  })();

  return (
    <header className="w-full bg-[#efefef] border-b border-gray-200">
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        {/* Left: Tabs */}
        <div className="flex items-center">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <nav className="flex items-center">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                const Icon = (item as any).icon;

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

        {/* Right: Status + Cancel + Refresh */}
        <div className="flex items-center gap-3">
          {/* Status-Chip */}
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 shadow-sm max-w-xs">
            <StatusDot status={connected ? overallStatus : "error"} />
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="font-medium truncate">{primaryLine}</span>
              <span className="text-[11px] text-gray-500 truncate">
                {secondaryLine}
              </span>
            </div>
          </div>

          {/* Cancel Button */}
          <button
            aria-label="Alle Druckjobs abbrechen"
            title="Alle Druckjobs abbrechen (TotalCancel)"
            disabled={cancelling || !connected}
            className="inline-flex h-9 w-20 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50 active:scale-[0.98] disabled:opacity-60"
            onClick={handleCancelJobs}
          >
            <OctagonX className="h-4 w-4" />
          </button>

          {/* Refresh Button */}
          <button
            aria-label="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
            onClick={() => {
              location.reload();
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
