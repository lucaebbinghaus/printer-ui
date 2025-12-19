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

// Helper to log to server-side logger
async function logToServer(level: "info" | "warn" | "error", message: string, context?: string, data?: any) {
  try {
    await fetch("/api/logs/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, message, context, data }),
    }).catch(() => {
      // Ignore errors - logging should not break the app
    });
  } catch {
    // Ignore errors
  }
}

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

  const errorNode = nodes.find((n) => n.name === "ERROR");
  const readyNode = nodes.find((n) => n.name === "READY");
  const errorTextNode = nodes.find((n) => n.name === "ERROR_TEXT");

  // 1) ERROR-Flag
  if (errorNode?.status === "error") return "error";

  // 2) Fehlertext gesetzt?
  if (errorTextNode?.rawValue) {
    const v = errorTextNode.rawValue as any;
    const text =
      typeof v === "string"
        ? v
        : typeof v?.text === "string"
        ? v.text
        : "";
    if (text) return "error";
  }

  // 3) READY fehlt → Warnung
  if (readyNode?.status === "warning") return "warning";

  // 4) Wenn wir überhaupt irgendwas Sinnvolles haben → OK
  if (errorNode || readyNode) return "ok";

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

    let es: EventSource | null = null;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;
    let reconnectAttempts = 0;
    let lastMessageTime = Date.now();
    let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const INITIAL_RECONNECT_DELAY = 3000;
    const MAX_RECONNECT_DELAY = 30000;
    const HEARTBEAT_TIMEOUT = 60000; // 1 Minute - wenn keine Nachricht kommt, reconnect

    function connect() {
      if (!isMounted) return;
      
      try {
        es = new EventSource("/api/status/printer/stream");
        reconnectAttempts = 0; // Reset on successful connection

        const handleMessage = (ev: MessageEvent) => {
          if (!isMounted || !es) return;
          
          // Ignore keep-alive comments
          if (ev.data.trim().startsWith(":")) {
            lastMessageTime = Date.now();
            return;
          }
          
          try {
            const json: PrinterStatus = JSON.parse(ev.data);
            lastMessageTime = Date.now();
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
          if (!isMounted || !es) return;
          
          // EventSource sends error event when connection is closed
          // Check if it's actually closed
          if (es.readyState === EventSource.CLOSED) {
            const timeSinceLastMessage = Date.now() - lastMessageTime;
            console.error("Status SSE connection closed");
            logToServer("warn", "SSE connection closed (StatusPage)", "STATUS_PAGE", {
              readyState: es.readyState,
              reconnectAttempt: reconnectAttempts + 1,
              timeSinceLastMessage: `${Math.round(timeSinceLastMessage / 1000)}s`,
            });
            es.close();
            es = null;

            // Only reconnect if we haven't exceeded max attempts
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && isMounted) {
              reconnectAttempts++;
              
              // Exponential backoff with max delay
              const delay = Math.min(
                INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
                MAX_RECONNECT_DELAY
              );
              
              setSseError(
                reconnectAttempts === 1
                  ? "Verbindung zum Status-Stream unterbrochen. Versuche erneut..."
                  : `Verbindung unterbrochen. Versuch ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`
              );
              setOverallStatus("error");

              reconnectTimeoutId = setTimeout(() => {
                if (isMounted) {
                  connect();
                }
              }, delay);
            } else if (isMounted) {
              // Max attempts reached
              logToServer("error", "SSE max reconnect attempts reached (StatusPage)", "STATUS_PAGE", {
                maxAttempts: MAX_RECONNECT_ATTEMPTS,
                lastMessageTime: lastMessageTime ? new Date(lastMessageTime).toISOString() : null,
              });
              setSseError("Verbindung zum Status-Stream konnte nicht wiederhergestellt werden. Bitte Seite neu laden.");
              setOverallStatus("error");
            }
          }
        };

        const handleOpen = () => {
          if (!isMounted) return;
          lastMessageTime = Date.now();
          setSseError(null);
          setLoading(false);
          
          logToServer("info", "SSE connection opened (StatusPage)", "STATUS_PAGE", {
            reconnectAttempt: reconnectAttempts,
          });
          
          // Start heartbeat checker
          if (heartbeatIntervalId) {
            clearInterval(heartbeatIntervalId);
            heartbeatIntervalId = null;
          }
          
          heartbeatIntervalId = setInterval(() => {
            if (!isMounted || !es) {
              if (heartbeatIntervalId) {
                clearInterval(heartbeatIntervalId);
                heartbeatIntervalId = null;
              }
              return;
            }
            
            // Check if we haven't received a message in too long
            const timeSinceLastMessage = Date.now() - lastMessageTime;
            if (timeSinceLastMessage > HEARTBEAT_TIMEOUT) {
              const timeSinceLastMessageSeconds = Math.round(timeSinceLastMessage / 1000);
              console.warn(`[StatusPage] No message for ${timeSinceLastMessage}ms, reconnecting...`);
              logToServer("warn", "SSE heartbeat timeout - no messages received (StatusPage)", "STATUS_PAGE", {
                timeSinceLastMessage: `${timeSinceLastMessageSeconds}s`,
                timeout: `${HEARTBEAT_TIMEOUT / 1000}s`,
                readyState: es?.readyState,
                reconnectAttempt: reconnectAttempts + 1,
              });
              if (es) {
                es.close();
                es = null;
              }
              if (heartbeatIntervalId) {
                clearInterval(heartbeatIntervalId);
                heartbeatIntervalId = null;
              }
              // Trigger reconnect
              if (isMounted) {
                connect();
              }
            }
          }, 30000); // Check every 30 seconds
        };

        es.onmessage = handleMessage;
        es.onerror = handleError;
        es.onopen = handleOpen;
      } catch (e) {
        console.error("Failed to create EventSource:", e);
        logToServer("error", "Failed to create EventSource (StatusPage)", "STATUS_PAGE", {
          error: e instanceof Error ? e.message : String(e),
          reconnectAttempt: reconnectAttempts + 1,
        });
        if (isMounted) {
          setSseError("Fehler beim Verbinden zum Status-Stream.");
          setOverallStatus("error");
        }
      }
    }

    // Initial connection
    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
      }
      if (es) {
        es.close();
        es = null;
      }
    };
  }, []);

  const connected = data?.connected ?? false;

  // Job-bezogene Nodes
  const activeNode = data?.nodes.find((n) => n.name === "ACTIVE");
  const labelsNode = data?.nodes.find((n) => n.name === "LABELS_TO_PRINT");
  const errorTextNode = data?.nodes.find((n) => n.name === "ERROR_TEXT");

  const isActive = Boolean(activeNode?.rawValue);
  const labelsRemaining =
    typeof labelsNode?.rawValue === "number"
      ? labelsNode.rawValue
      : labelsNode?.rawValue ?? null;

  let errorText = "";
  if (errorTextNode?.rawValue) {
    const v = errorTextNode.rawValue as any;
    errorText =
      typeof v === "string"
        ? v
        : typeof v?.text === "string"
        ? v.text
        : String(v);
  }

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
            router.refresh();
            location.reload();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
        >
          <RefreshCcw className="w-4 h-4" /> Neu laden
        </button>
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

        {/* Gesamtstatus-Chip */}
          {connected ? (
            overallStatus === "ok" ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                OK
              </span>
            ) : overallStatus === "warning" ? (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Warnung
              </span>
            ) : overallStatus === "error" ? (
              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
                <XCircle className="w-3 h-3" />
                Fehler
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full">
                Unbekannt
              </span>
            )
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

      {/* Job-Status */}
      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Job-Status</h2>
          {isActive ? (
            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Läuft
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
              Leerlauf
            </span>
          )}
        </div>

        <div className="space-y-1 text-sm text-gray-800">
          <div className="flex justify-between">
            <span>Aktiv:</span>
            <span className="font-medium">
              {isActive ? "Druckt / interpretiert" : "Nein"}
            </span>
          </div>

          {labelsRemaining !== null && (
            <div className="flex justify-between">
              <span>Verbleibende Etiketten (Labels To Print):</span>
              <span className="font-mono font-medium">
                {String(labelsRemaining)}
              </span>
            </div>
          )}

          {errorText && (
            <div className="pt-2 border-t border-gray-100 text-sm text-red-700">
              <div className="text-xs uppercase tracking-wide text-red-500 mb-0.5">
                Fehlertext vom Drucker
              </div>
              <div>{errorText}</div>
            </div>
          )}
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
