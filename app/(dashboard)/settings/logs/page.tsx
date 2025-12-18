"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCcw, Trash2, FileText } from "lucide-react";

type LogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  context?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  data?: any;
};

type LogsResponse = {
  ok: boolean;
  logs: LogEntry[];
  count: number;
  error?: string;
};

function formatLogEntry(entry: LogEntry): string {
  const parts = [
    entry.timestamp,
    `[${entry.level.toUpperCase()}]`,
    entry.context ? `[${entry.context}]` : "",
    entry.message,
  ].filter(Boolean);

  let logLine = parts.join(" ");

  if (entry.error) {
    logLine += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
    if (entry.error.code) {
      logLine += ` (code: ${entry.error.code})`;
    }
    if (entry.error.stack) {
      logLine += `\n  Stack: ${entry.error.stack}`;
    }
  }

  if (entry.data) {
    try {
      const dataStr = typeof entry.data === "string" 
        ? entry.data 
        : JSON.stringify(entry.data, null, 2);
      logLine += `\n  Data: ${dataStr}`;
    } catch {
      logLine += `\n  Data: [unable to stringify]`;
    }
  }

  return logLine;
}

function getLogLevelColor(level: string): string {
  switch (level) {
    case "error":
      return "text-red-600";
    case "warn":
      return "text-yellow-600";
    case "info":
      return "text-blue-600";
    case "debug":
      return "text-gray-500";
    default:
      return "text-gray-700";
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const logRef = useRef<HTMLPreElement | null>(null);
  const logWrapRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  async function loadLogs() {
    try {
      setError(null);
      const res = await fetch("/api/logs?limit=1000", { cache: "no-store" });
      const json: LogsResponse = await res.json().catch(() => ({ ok: false } as any));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load logs");
      }

      setLogs(json.logs || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  async function clearLogs() {
    if (!confirm("Alle Logs wirklich löschen?")) return;

    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear logs");
      await loadLogs();
    } catch (e: any) {
      setError(e?.message || "Failed to clear logs");
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    if (autoScroll && logRef.current && logWrapRef.current) {
      logWrapRef.current.scrollTop = logWrapRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const onLogScroll = () => {
    if (!logWrapRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logWrapRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setAutoScroll(isAtBottom);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === "all") return true;
    return log.level === filterLevel;
  });

  const formattedLogs = filteredLogs.map(formatLogEntry).join("\n\n");

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <div className="p-4 max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Zeigt die Logs der Anwendung an ({logs.length} Einträge)
            {errorCount > 0 && (
              <span className="ml-2 text-red-600 font-semibold">
                {errorCount} Fehler
              </span>
            )}
            {warnCount > 0 && (
              <span className="ml-2 text-yellow-600 font-semibold">
                {warnCount} Warnungen
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-Refresh
          </label>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">Filter:</span>
        {["all", "error", "warn", "info", "debug"].map((level) => (
          <button
            key={level}
            onClick={() => setFilterLevel(level)}
            className={[
              "px-3 py-1 text-xs font-medium rounded-lg border transition",
              filterLevel === level
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            {level === "all" ? "Alle" : level.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Logs Display */}
      <div className="rounded-lg border border-gray-200 bg-gray-50">
        <div className="px-3 pt-3 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-600">
            Logs (letzte {filteredLogs.length} Einträge)
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              Auto-Scroll:{" "}
              <span className={autoScroll ? "text-gray-900 font-semibold" : ""}>
                {autoScroll ? "an" : "aus"}
              </span>
            </div>
            <button
              onClick={clearLogs}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:bg-gray-50 active:scale-[0.98]"
            >
              <Trash2 className="w-3 h-3" />
              Löschen
            </button>
          </div>
        </div>
        <div
          ref={logWrapRef}
          onScroll={onLogScroll}
          className="px-3 pb-3 max-h-[600px] overflow-auto"
        >
          <pre
            ref={logRef}
            className="text-xs whitespace-pre-wrap break-words font-mono"
          >
            {formattedLogs || "— Keine Logs —"}
          </pre>
        </div>
      </div>
    </div>
  );
}

