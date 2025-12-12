"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCcw, PackageCheck } from "lucide-react";

const UNLOCK_KEY = "settingsUnlockUntil";
const LAST_SYNC_KEY = "productsLastSyncAt";

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "";
  }
}

export default function SettingsGeneralPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Last updated
  const [lastSyncAt, setLastSyncAt] = useState<string>("");

  // Long-press unlock
  const [pressing, setPressing] = useState(false);
  const [pressMs, setPressMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    // Load last sync timestamp
    try {
      const raw = localStorage.getItem(LAST_SYNC_KEY) || "";
      setLastSyncAt(raw);
    } catch {
      setLastSyncAt("");
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/sync/xano-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Request failed: ${res.status}`);
      }

      // Save last sync timestamp
      const nowIso = new Date().toISOString();
      try {
        localStorage.setItem(LAST_SYNC_KEY, nowIso);
      } catch {}
      setLastSyncAt(nowIso);

      setMsg("Produkte erfolgreich abgerufen und gespeichert.");
    } catch (e: any) {
      setMsg(e?.message || "Produkte abrufen fehlgeschlagen.");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  function unlockAdvanced() {
    // z. B. 15 Minuten freischalten
    const until = Date.now() + 15 * 60 * 1000;
    localStorage.setItem(UNLOCK_KEY, String(until));

    // Sidebar im selben Tab informieren
    window.dispatchEvent(new Event("settings-unlock-changed"));

    setMsg("Erweiterte Einstellungen freigeschaltet (15 Minuten).");
    setTimeout(() => setMsg(null), 5000);
  }

  function startPress() {
    if (pressing) return;

    setPressing(true);
    setPressMs(0);

    // Fortschritt anzeigen
    tickRef.current = window.setInterval(() => {
      setPressMs((ms) => Math.min(ms + 100, 5000));
    }, 100);

    // nach 5s freischalten
    timerRef.current = window.setTimeout(() => {
      stopPress(true);
      unlockAdvanced();
    }, 5000);
  }

  function stopPress(triggered = false) {
    setPressing(false);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }

    if (!triggered) setPressMs(0);
  }

  const progress = Math.round((pressMs / 5000) * 100);
  const lastSyncLabel = lastSyncAt ? formatDateTime(lastSyncAt) : "";

  return (
    <div className="p-4">
      <div className="max-w-3xl space-y-4">
        {/* Title (5s hold unlock) */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-lg font-semibold text-gray-900 select-none inline-flex items-center gap-2"
              onPointerDown={startPress}
              onPointerUp={() => stopPress(false)}
              onPointerCancel={() => stopPress(false)}
              onPointerLeave={() => stopPress(false)}
              title="5 Sekunden halten, um erweiterte Settings freizuschalten"
            >
              Allgemein
            </h1>

            {pressing && (
              <div className="mt-2 w-64">
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-gray-900 transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Halten… {progress}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card: Produkte abrufen */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  Produkte abrufen
                </h2>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Syncronisiert die Produktdaten mit der Cloud.
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Zuletzt aktualisiert:{" "}
                <span className="font-medium text-gray-700">
                  {lastSyncLabel || "—"}
                </span>
              </p>
            </div>

            <button
              onClick={fetchProducts}
              disabled={loading}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition",
                loading
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]",
              ].join(" ")}
            >
              <RefreshCcw className="h-4 w-4" />
              {loading ? "Abrufen..." : "Produkte abrufen"}
            </button>
          </div>

          {msg && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              {msg}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
