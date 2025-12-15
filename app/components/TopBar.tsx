"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import {
  RotateCcw,
  OctagonX,
  Maximize2,
  Minimize2,
  Power,
} from "lucide-react";
import type { LampStatus } from "@/app/lib/opcuaWatcher";
import { usePrinterStatus } from "@/app/lib/usePrinterStatus";

/* ---------------- Status Dot ---------------- */

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

/* ---------------- TopBar ---------------- */

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
  const [isFullscreen, setIsFullscreen] = useState(true);

  // Portal mount flag
  const [mounted, setMounted] = useState(false);

  const electronAPI =
    typeof window !== "undefined" ? (window as any).electronAPI : null;

  const isLabelsPage =
    pathname === "/labels" || pathname.startsWith("/labels/");

  useEffect(() => {
    setMounted(true);
  }, []);

  /* -------- initial Fullscreen-Status -------- */

  useEffect(() => {
    if (!electronAPI?.getFullscreenState) return;

    electronAPI
      .getFullscreenState()
      .then((v: boolean) => setIsFullscreen(Boolean(v)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- Resize Toggle -------- */

  async function handleToggleResize() {
    if (!electronAPI?.toggleResize) return;

    try {
      await electronAPI.toggleResize();
      const state = await electronAPI.getFullscreenState?.();
      if (typeof state === "boolean") setIsFullscreen(state);
    } catch {}
  }

  /* -------- Cancel Jobs -------- */

  async function handleCancelJobs() {
    if (cancelling) return;

    setCancelling(true);
    try {
      const res = await fetch("/api/print/cancel", { method: "POST" });
      if (!res.ok) throw new Error();

      setTempMessage("Alle Druckjobs wurden abgebrochen.");
      setTimeout(() => setTempMessage(null), 4000);
    } catch {
      setTempMessage("Fehler beim Abbrechen der Jobs.");
      setTimeout(() => setTempMessage(null), 4000);
    } finally {
      setCancelling(false);
    }
  }

  /* -------- Status Text -------- */

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

  const primaryLine = (() => {
    if (!connected) return "Drucker nicht verbunden";
    if (!isReady) return "Drucker nicht bereit";
    return "Drucker bereit";
  })();

  /* ---------------- Render ---------------- */

  return (
    <>
      {/* TOP BAR – immer über Content */}
      <header className="sticky top-0 z-[1000] w-full bg-[#efefef] border-b border-gray-200">
        <div className="mx-auto flex h-14 items-center justify-between px-4">
          {/* Left: Navigation */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden [-webkit-app-region:no-drag]">
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
                      "[-webkit-app-region:no-drag]",
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

          {/* Right: Status + Actions */}
          <div className="flex items-center gap-3 [-webkit-app-region:no-drag]">
            {/* Status */}
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 shadow-sm max-w-xs">
              <StatusDot status={connected ? overallStatus : "error"} />
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="font-medium truncate">{primaryLine}</span>
                <span className="text-[11px] text-gray-500 truncate">
                  {secondaryLine}
                </span>
              </div>
            </div>

            {/* Refresh */}
            <button
              aria-label="Refresh"
              onClick={() => location.reload()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Resize */}
            <button
              aria-label="Fenstergröße umschalten"
              onClick={handleToggleResize}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            {/* Shutdown */}
            <button
              aria-label="Host herunterfahren"
              onClick={() => {
                if (confirm("System wirklich herunterfahren?")) {
                  electronAPI?.shutdownHost?.();
                }
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50 active:scale-[0.98]"
            >
              <Power className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* CANCEL – per Portal direkt nach <body>, damit garantiert klickbar */}
      {mounted && isLabelsPage
        ? createPortal(
            <div
              className="fixed right-6 bottom-6 pointer-events-none"
              style={{ zIndex: 2147483647 }}
            >
              <button
                aria-label="Alle Druckjobs abbrechen"
                title="Alle Druckjobs abbrechen"
                disabled={cancelling}
                onClick={handleCancelJobs}
                onPointerDown={(e) => e.stopPropagation()}
                className={[
                  "pointer-events-auto",
                  "[-webkit-app-region:no-drag]",
                  "inline-flex h-14 w-14 items-center justify-center rounded-2xl",
                  "border border-red-200 bg-white text-red-600 shadow-xl",
                  "hover:bg-red-50 active:scale-[0.97]",
                  "disabled:opacity-60",
                  "touch-manipulation",
                ].join(" ")}
              >
                <OctagonX className="h-6 w-6" />
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
