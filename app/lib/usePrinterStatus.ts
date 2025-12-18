// app/lib/usePrinterStatus.ts
"use client";

import { useEffect, useState } from "react";
import type { LampStatus, PrinterNode } from "./opcuaWatcher";

export type PrinterStatusResponse = {
  connected: boolean;
  endpoint: string | null;
  nodes: PrinterNode[];
  error?: string;
};

function deriveOverallStatus(nodes: PrinterNode[]): LampStatus {
  if (!nodes || nodes.length === 0) return "unknown";

  const errorNode = nodes.find((n) => n.name === "ERROR");
  const errorTextNode = nodes.find((n) => n.name === "ERROR_TEXT");
  const readyNode = nodes.find((n) => n.name === "READY");

  // Fehler → rot
  if (errorNode?.status === "error") return "error";

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

  // READY auswerten: nur wenn TRUE → ok, sonst warning
  const isReady = readyNode
    ? Boolean(
        typeof readyNode.rawValue === "number"
          ? readyNode.rawValue !== 0
          : readyNode.rawValue
      )
    : false;

  if (!isReady) return "warning";

  return "ok";
}

export function usePrinterStatus() {
  const [data, setData] = useState<PrinterStatusResponse | null>(null);
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
    const MAX_RECONNECT_ATTEMPTS = 10;
    const INITIAL_RECONNECT_DELAY = 3000;
    const MAX_RECONNECT_DELAY = 30000;

    function connect() {
      if (!isMounted) return;
      
      try {
        es = new EventSource("/api/status/printer/stream");
        reconnectAttempts = 0; // Reset on successful connection

        const handleMessage = (ev: MessageEvent) => {
          if (!isMounted || !es) return;
          try {
            const json: PrinterStatusResponse = JSON.parse(ev.data);
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
            console.error("Status SSE connection closed");
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
              setSseError("Verbindung zum Status-Stream konnte nicht wiederhergestellt werden. Bitte Seite neu laden.");
              setOverallStatus("error");
            }
          }
        };

        const handleOpen = () => {
          if (!isMounted) return;
          setSseError(null);
          setLoading(false);
        };

        es.onmessage = handleMessage;
        es.onerror = handleError;
        es.onopen = handleOpen;
      } catch (e) {
        console.error("Failed to create EventSource:", e);
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
      if (es) {
        es.close();
        es = null;
      }
    };
  }, []);

  const connected = data?.connected ?? false;

  // Nodes für Ready / Active / Labels / Error-Text
  const nodes = data?.nodes ?? [];
  const readyNode = nodes.find((n) => n.name === "READY");
  const activeNode = nodes.find((n) => n.name === "ACTIVE");
  const labelsNode = nodes.find((n) => n.name === "LABELS_TO_PRINT");
  const errorTextNode = nodes.find((n) => n.name === "ERROR_TEXT");

  const isReady = readyNode
    ? Boolean(
        typeof readyNode.rawValue === "number"
          ? readyNode.rawValue !== 0
          : readyNode.rawValue
      )
    : false;

  const isActive = Boolean(activeNode?.rawValue);

  const labelsRemainingRaw =
    typeof labelsNode?.rawValue === "number"
      ? labelsNode.rawValue
      : labelsNode?.rawValue ?? null;

  const labelsRemaining =
    typeof labelsRemainingRaw === "number" ? labelsRemainingRaw : null;

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

  return {
    data,
    overallStatus: connected ? overallStatus : ("error" as LampStatus),
    connected,
    isReady,
    isActive,
    labelsRemaining,
    errorText: errorText || null,
    loading,
    sseError,
  };
}
