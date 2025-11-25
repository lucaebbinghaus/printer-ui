"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Info,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// Typen aus dem Watcher gespiegelt
type LampStatus = "ok" | "warning" | "error" | "unknown";

type PrinterNode = {
  id: string;
  name: string;
  status: LampStatus;
  rawValue: any;
  nodeId: string;
};

type PrinterStatus = {
  connected: boolean;
  endpoint: string | null;
  nodes: PrinterNode[];
  error?: string;
};

function StatusLamp({ status }: { status: LampStatus }) {
  const base = "inline-block w-3 h-3 rounded-full";
  const colors: Record<LampStatus, string> = {
    ok: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]",
    warning:
      "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse",
    error: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse",
    unknown: "bg-gray-400",
  };
  return <span className={`${base} ${colors[status]}`} />;
}

function statusLabel(status: LampStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warning":
      return "Warnung";
    case "error":
      return "Fehler";
    default:
      return "Unbekannt";
  }
}

function deriveOverallStatus(nodes: PrinterNode[]): LampStatus {
  if (!nodes || nodes.length === 0) return "unknown";
  if (nodes.some((n) => n.status === "error")) return "error";
  if (nodes.some((n) => n.status === "warning")) return "warning";
  if (nodes.every((n) => n.status === "ok")) return "ok";
  return "unknown";
}

export default function StatusPage() {
  const router = useRouter();

  const [data, setData] = useState<PrinterStatus | null>(null);
  const [overallStatus, setOverallStatus] = useState<LampStatus>("unknown");
  const [loading, setLoading] = useState(true);
  const [sseError, setSseError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setSseError(null);

    let es: EventSource | null = new EventSource(
      "/api/status/printer/stream"
    );

    const handleMessage = (ev: MessageEvent) => {
      try {
        const json: PrinterStatus = JSON.parse(ev.data);
        setData(json);
        setLoading(false);
        setSseError(null);

        const overall = json.connected
          ? deriveOverallStatus(json.nodes || [])
          : ("error" as LampStatus);

        setOverallStatus(overall);
      } catch (e) {
        console.error("Status SSE parse error", e);
      }
    };

    const handleError = (ev: Event) => {
      console.error("Status SSE error", ev);
      setSseError("Verbindung zum Status-Stream unterbrochen.");
      setOverallStatus("error");
      // Verbindung schließen – evtl. später Auto-Reconnect ergänzen
      es?.close();
    };

    es.onmessage = handleMessage;
    es.onerror = handleError;

    return () => {
      es?.close();
    };
  }, []);

  const connected = data?.connected ?? false;

  if (loading && !data) {
    return <div className="p-4">Lade Druckerstatus…</div>;
  }

  return (
    <div className="p-4 max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Printer / OPC-UA Status</h1>
        <button
          onClick={() => {
            // Harte Aktualisierung der Seite & SSE-Verbindung
            router.refresh();
            location.reload();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
        >
          <RefreshCcw className="w-4 h-4" /> Neu laden
        </button>
      </div>

      {/* Info-Box */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-200 text-sm">
        <Info className="w-4 h-4 mt-0.5" />
        <p>
          Anzeige des aktuellen OPC-UA Status des Druckers (READY, ERROR,
          JOBRDY, FEEDON, …) basierend auf der in der Konfiguration gesetzten
          Printer-IP. Die Werte werden in Echtzeit über Server-Sent Events
          aktualisiert.
        </p>
      </div>

      {/* OPC-UA Verbindung */}
      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusLamp status={connected ? "ok" : "error"} />
            <div>
              <div className="text-sm font-medium text-gray-800">
                OPC-UA Verbindung
              </div>
              <div className="text-xs text-gray-500">
                {connected
                  ? `Verbunden mit ${data?.endpoint ?? "unbekannt"}`
                  : "Keine Verbindung"}
              </div>
            </div>
          </div>
          {connected ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
              <XCircle className="w-3 h-3" />
              Fehler
            </span>
          )}
        </div>

        {/* Legende */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1">
            <StatusLamp status="ok" />
            <span>OK</span>
          </div>
          <div className="flex items-center gap-1">
            <StatusLamp status="warning" />
            <span>Warnung</span>
          </div>
          <div className="flex items-center gap-1">
            <StatusLamp status="error" />
            <span>Fehler</span>
          </div>
          <div className="flex items-center gap-1">
            <StatusLamp status="unknown" />
            <span>Unbekannt</span>
          </div>
        </div>
      </section>

      {/* I/O Status-Signale */}
      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            I/O / Status-Signale
          </h2>
          {data?.nodes?.length ? (
            <span className="text-xs text-gray-500">
              {data.nodes.length} Signale
            </span>
          ) : null}
        </div>

        {data?.nodes?.length ? (
          <div className="divide-y divide-gray-100">
            {data.nodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3">
                  <StatusLamp status={node.status} />
                  <div>
                    <div className="text-sm text-gray-800">{node.name}</div>
                    <div className="text-xs text-gray-500">
                      Status: {statusLabel(node.status)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-gray-800">
                    {String(node.rawValue)}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    NodeId: {node.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertTriangle className="w-4 h-4 text-gray-400" />
            <span>Keine Status-Signale gefunden oder keine Verbindung.</span>
          </div>
        )}
      </section>

      {/* Fehleranzeigen */}
      {sseError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5" />
          <span>{sseError}</span>
        </div>
      )}
      {data?.error && !sseError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5" />
          <span>{data.error}</span>
        </div>
      )}
    </div>
  );
}
