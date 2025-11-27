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

    let es: EventSource | null = new EventSource(
      "/api/status/printer/stream"
    );

    const handleMessage = (ev: MessageEvent) => {
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
      console.error("Status SSE error", ev);
      setSseError("Verbindung zum Status-Stream unterbrochen.");
      setOverallStatus("error");
      es?.close();

      // Auto-Reconnect
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
