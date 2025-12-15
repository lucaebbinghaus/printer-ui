"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, RotateCcw } from "lucide-react";

type BackupInfo = {
  id: string;
  createdAt: string;
  sizeBytes: number;
};

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatBytes(n: number) {
  if (!Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupsManager() {
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [currentFromBackupId, setCurrentFromBackupId] = useState<string | null>(
    null
  );
  const [backups, setBackups] = useState<BackupInfo[]>([]);

  async function load() {
    setLoading(true);
    setMsg(null);
    setErr(null);

    try {
      const res = await fetch("/api/products/backups", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load");

      setBackups(Array.isArray(json.backups) ? json.backups : []);
      setCurrentFromBackupId(json.currentFromBackupId || null);
    } catch (e: any) {
      setErr(e?.message || "Fehler beim Laden der Backups.");
    } finally {
      setLoading(false);
    }
  }

  async function restore(backupId: string) {
    setRestoring(backupId);
    setMsg(null);
    setErr(null);

    try {
      const res = await fetch("/api/products/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || json?.message || "Restore failed");
      }

      setMsg(`Wiederhergestellt: ${backupId}`);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Fehler beim Wiederherstellen.");
    } finally {
      setRestoring(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Backups wiederherstellen
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Es werden automatisch bis zu 10 Backups gespeichert (Datum/Uhrzeit).
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Aktueller Stand:{" "}
            <span className="font-medium text-gray-700">
              {currentFromBackupId
                ? `aus Backup ${currentFromBackupId}`
                : "Live (nach Sync)"}
            </span>
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className={[
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition",
            loading
              ? "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98]",
          ].join(" ")}
        >
          <RefreshCcw className="w-4 h-4" />
          {loading ? "Lade..." : "Aktualisieren"}
        </button>
      </div>

      {msg ? (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          {err}
        </div>
      ) : null}

      <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
        <div className="grid grid-cols-[1fr_110px_140px] gap-2 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
          <div>Datei</div>
          <div>Größe</div>
          <div className="text-right">Aktion</div>
        </div>

        {backups.length === 0 ? (
          <div className="px-3 py-3 text-sm text-gray-600">
            Noch keine Backups vorhanden.
          </div>
        ) : (
          backups.map((b) => {
            const isCurrent = currentFromBackupId === b.id;

            return (
              <div
                key={b.id}
                className="grid grid-cols-[1fr_110px_140px] gap-2 border-t border-gray-200 px-3 py-2 items-center"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {b.id} {isCurrent ? "(aktiv)" : ""}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDateTime(b.createdAt)}
                  </div>
                </div>

                <div className="text-xs text-gray-600">
                  {formatBytes(b.sizeBytes)}
                </div>

                <div className="text-right">
                  <button
                    onClick={() => restore(b.id)}
                    disabled={!!restoring || isCurrent}
                    className={[
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition",
                      isCurrent || restoring
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.98]",
                    ].join(" ")}
                    title={
                      isCurrent
                        ? "Dieses Backup ist bereits aktiv."
                        : "Dieses Backup wiederherstellen"
                    }
                  >
                    <RotateCcw className="w-4 h-4" />
                    {restoring === b.id ? "Restore..." : "Restore"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-gray-500">
        Hinweis: Beim Restore wird automatisch ein Sicherheits-Backup des aktuellen
        Stands erstellt, bevor überschrieben wird.
      </p>
    </section>
  );
}
