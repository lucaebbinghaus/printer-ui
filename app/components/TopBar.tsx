"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { RotateCcw, OctagonX } from "lucide-react";
import type { LampStatus, PrinterNode } from "@/app/lib/opcuaWatcher";

type PrinterStatusResponse = {
  connected: boolean;
  endpoint: string | null;
  nodes: PrinterNode[];
  error?: string;
};

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

function deriveOverallStatus(nodes: PrinterNode[]): LampStatus {
  if (!nodes || nodes.length === 0) return "unknown";
  if (nodes.some((n) => n.status === "error")) return "error";
  if (nodes.some((n) => n.status === "warning")) return "warning";
  if (nodes.every((n) => n.status === "ok")) return "ok";
  return "unknown";
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  const [overallStatus, setOverallStatus] = useState<LampStatus>("unknown");
  const [statusText, setStatusText] = useState("Status…");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let es: EventSource | null = new EventSource(
      "/api/status/printer/stream"
    );

    const handleMessage = (ev: MessageEvent) => {
      const data: PrinterStatusResponse = JSON.parse(ev.data);

      if (!data.connected) {
        setOverallStatus("error");
        setStatusText("Nicht verbunden");
        return;
      }

      const ovr = deriveOverallStatus(data.nodes || []);
      setOverallStatus(ovr);

      switch (ovr) {
        case "ok":
          setStatusText("Drucker OK");
          break;
        case "warning":
          setStatusText("Warnung");
          break;
        case "error":
          setStatusText("Fehler");
          break;
        default:
          setStatusText("Unbekannt");
      }
    };

    const handleError = () => {
      setOverallStatus("error");
      setStatusText("Verbindung unterbrochen");
      es?.close();
      setTimeout(() => {
        es = new EventSource("/api/status/printer/stream");
        es.onmessage = handleMessage;
        es.onerror = handleError;
      }, 3000);
    };

    es.onmessage = handleMessage;
    es.onerror = handleError;

    return () => {
      es?.close();
    };
  }, []);

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
      // Kleines Feedback im Status-Text
      setStatusText("Jobs abgebrochen");
      setTimeout(() => {
        // nach kurzer Zeit wieder normalen Status anzeigen lassen (SSE aktualisiert sowieso)
        setStatusText((prev) =>
          prev === "Jobs abgebrochen" ? "Drucker OK" : prev
        );
      }, 3000);
    } catch (e) {
      console.error(e);
      setStatusText("Abbruch-Fehler");
    } finally {
      setCancelling(false);
    }
  }

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
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 shadow-sm">
            <StatusDot status={overallStatus} />
            <span>{statusText}</span>
          </div>

          {/* Cancel Button */}
          <button
            aria-label="Alle Druckjobs abbrechen"
            title="Alle Druckjobs abbrechen (TotalCancel)"
            disabled={cancelling}
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
