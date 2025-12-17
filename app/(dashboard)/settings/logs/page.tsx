"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCcw, CheckCircle2, XCircle, AlertCircle, Trash2 } from "lucide-react";

type DockerService = {
  name: string;
  status: string;
  health?: string;
  logs: string;
  error?: string;
};

type LogsResponse = {
  ok: boolean;
  services: DockerService[];
  allHealthy: boolean;
  timestamp?: string;
  error?: string;
};

export default function LogsPage() {
  const [services, setServices] = useState<DockerService[]>([]);
  const [allHealthy, setAllHealthy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const logWrapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [autoScroll, setAutoScroll] = useState<Record<string, boolean>>({
    "printer-ui": true,
    "zplbox": true,
  });

  async function loadLogs() {
    try {
      setError(null);
      const res = await fetch("/api/logs/docker", { cache: "no-store" });
      const json: LogsResponse = await res.json().catch(() => ({ ok: false } as any));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load logs");
      }

      setServices(json.services || []);
      setAllHealthy(json.allHealthy || false);
    } catch (e: any) {
      setError(e?.message || "Failed to load docker logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadLogs();
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Auto-scroll for each service
  useEffect(() => {
    Object.entries(logWrapRefs.current).forEach(([name, el]) => {
      if (!el || !autoScroll[name]) return;
      el.scrollTop = el.scrollHeight;
    });
  }, [services, autoScroll]);

  function onLogScroll(name: string) {
    const el = logWrapRefs.current[name];
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setAutoScroll((prev) => ({ ...prev, [name]: atBottom }));
  }

  function getStatusIcon(status: string, health?: string) {
    if (status === "running") {
      if (health === "healthy") {
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      } else if (health === "unhealthy") {
        return <XCircle className="w-4 h-4 text-red-600" />;
      } else {
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      }
    }
    return <XCircle className="w-4 h-4 text-red-600" />;
  }

  function getStatusBadge(status: string, health?: string) {
    if (status === "unavailable") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-gray-800 text-xs">
          <AlertCircle className="w-3 h-3" />
          Nicht verfügbar
        </span>
      );
    }
    if (status === "running") {
      if (health === "healthy") {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-green-800 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            Healthy
          </span>
        );
      } else if (health === "unhealthy") {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-red-800 text-xs">
            <XCircle className="w-3 h-3" />
            Unhealthy
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-yellow-800 text-xs">
            <AlertCircle className="w-3 h-3" />
            Running
          </span>
        );
      }
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-red-800 text-xs">
        <XCircle className="w-3 h-3" />
        {status}
      </span>
    );
  }

  const displayedServices = selectedService
    ? services.filter((s) => s.name === selectedService)
    : services;

  return (
    <div className="p-4 max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Docker Logs</h1>
        <p className="mt-1 text-sm text-gray-600">
          Zeigt die Logs und den Status der Docker Services an.
        </p>
      </div>

      {/* Overall Health Status */}
      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-700 font-semibold">Gesamtstatus</div>
            {allHealthy ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-800 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Alle Services laufen gesund
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-red-800 text-sm font-medium">
                <XCircle className="w-4 h-4" />
                Einige Services haben Probleme
              </span>
            )}
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
              className={[
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition",
                loading
                  ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98]",
              ].join(" ")}
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Aktualisieren
            </button>
          </div>
        </div>
      </section>

      {/* Service Filter */}
      {services.length > 1 && (
        <section className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600 font-medium">Service:</span>
            <button
              onClick={() => setSelectedService(null)}
              className={[
                "px-3 py-1 rounded-lg text-xs font-medium transition",
                selectedService === null
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200",
              ].join(" ")}
            >
              Alle
            </button>
            {services.map((s) => (
              <button
                key={s.name}
                onClick={() => setSelectedService(s.name)}
                className={[
                  "px-3 py-1 rounded-lg text-xs font-medium transition",
                  selectedService === s.name
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                ].join(" ")}
              >
                {s.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Docker Socket Warning */}
      {services.some((s) => s.status === "unavailable") && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm">
              <div className="font-semibold">Docker-Zugriff nicht verfügbar</div>
              <p>
                Um Docker-Logs anzuzeigen, muss der Docker Socket in der{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">docker-compose.yml</code>{" "}
                gemountet werden:
              </p>
              <pre className="bg-amber-100 p-2 rounded text-xs overflow-x-auto">
{`volumes:
  - printer-ui-data:/data
  - /var/run/docker.sock:/var/run/docker.sock`}
              </pre>
              <p className="text-xs text-amber-700">
                Nach dem Hinzufügen muss der Container neu gestartet werden.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Service Logs */}
      <div className="space-y-4">
        {displayedServices.map((service) => (
          <section
            key={service.name}
            className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(service.status, service.health)}
                <div className="text-sm font-semibold text-gray-800">{service.name}</div>
                {getStatusBadge(service.status, service.health)}
              </div>

              <div className="text-xs text-gray-500">
                Auto-Scroll:{" "}
                <span className={autoScroll[service.name] ? "text-gray-900 font-semibold" : ""}>
                  {autoScroll[service.name] ? "an" : "aus"}
                </span>
              </div>
            </div>

            {service.error ? (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                {service.error}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="px-3 pt-3 text-xs font-semibold text-gray-600 mb-2">
                  Logs (letzte 200 Zeilen)
                </div>
                <div
                  ref={(el) => {
                    logWrapRefs.current[service.name] = el;
                  }}
                  onScroll={() => onLogScroll(service.name)}
                  className="px-3 pb-3 max-h-[400px] overflow-auto"
                >
                  <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                    {service.logs || "—"}
                  </pre>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {services.length === 0 && !loading && (
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm text-center text-gray-500">
          Keine Docker Services gefunden.
        </div>
      )}
    </div>
  );
}

