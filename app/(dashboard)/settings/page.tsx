"use client";

import { useEffect, useRef, useState } from "react";
import { Save, RefreshCcw, Info, PackageCheck } from "lucide-react";

type AppConfig = {
  general?: {
    defaultLabelQty?: number;
  };
  ui?: {
    startPresetId?: string | null;
  };
};

type PresetSummary = {
  id: string;
  name: string;
};

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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [defaultLabelQty, setDefaultLabelQty] = useState<number | string>(1);
  const [startPresetId, setStartPresetId] = useState<string | "">("");

  const [presets, setPresets] = useState<PresetSummary[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Produkte abrufen + Last updated
  const [fetchingProducts, setFetchingProducts] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string>("");

  // Long-press unlock (5s)
  const [pressing, setPressing] = useState(false);
  const [pressMs, setPressMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Last sync timestamp laden
    try {
      const raw = localStorage.getItem(LAST_SYNC_KEY) || "";
      setLastSyncAt(raw);
    } catch {
      setLastSyncAt("");
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Config laden
      const resCfg = await fetch("/api/settings/config", { cache: "no-store" });
      if (!resCfg.ok) throw new Error("config load failed");
      const cfg: AppConfig = await resCfg.json();

      setDefaultLabelQty(Number(cfg.general?.defaultLabelQty ?? 1));
      setStartPresetId((cfg.ui?.startPresetId as string) || "");

      // Presets laden (für Dropdown)
      try {
        const resPresets = await fetch("/api/presets", { cache: "no-store" });
        if (resPresets.ok) {
          const list: PresetSummary[] = await resPresets.json();
          setPresets(list);
        } else {
          console.warn("Presets load failed", await resPresets.text());
        }
      } catch (e) {
        console.warn("Presets request failed", e);
      }
    } catch {
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const qty = Math.max(1, Math.floor(Number(defaultLabelQty) || 1));

      const res = await fetch("/api/settings/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          general: { defaultLabelQty: qty },
          ui: {
            startPresetId: startPresetId || null,
          },
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Speichern fehlgeschlagen");
      }

      setSuccess("Einstellungen gespeichert.");
      setDefaultLabelQty(qty);
    } catch (e: any) {
      setError(e?.message || "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function fetchProducts() {
    setFetchingProducts(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/sync/supabase-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Request failed: ${res.status}`);
      }

      const nowIso = new Date().toISOString();
      try {
        localStorage.setItem(LAST_SYNC_KEY, nowIso);
      } catch {}
      setLastSyncAt(nowIso);

      setSuccess("Produkte erfolgreich abgerufen und gespeichert.");
    } catch (e: any) {
      setError(e?.message || "Produkte abrufen fehlgeschlagen.");
    } finally {
      setFetchingProducts(false);
      
      // Cleanup previous timeouts
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      
      // Set new timeouts
      successTimeoutRef.current = setTimeout(() => setSuccess(null), 5000);
      errorTimeoutRef.current = setTimeout(() => setError(null), 5000);
    }
  }

  function unlockAdvanced() {
    // z. B. 15 Minuten freischalten
    const until = Date.now() + 15 * 60 * 1000;
    localStorage.setItem(UNLOCK_KEY, String(until));

    // Sidebar im selben Tab informieren
    window.dispatchEvent(new Event("settings-unlock-changed"));

    // Cleanup previous timeout
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    
    setSuccess("Erweiterte Einstellungen freigeschaltet (15 Minuten).");
    successTimeoutRef.current = setTimeout(() => setSuccess(null), 5000);
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

  if (loading) {
    return <div className="p-4">Lade Einstellungen…</div>;
  }

  return (
    <div className="p-4 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-lg font-semibold select-none inline-flex items-center gap-2"
            onPointerDown={startPress}
            onPointerUp={() => stopPress(false)}
            onPointerCancel={() => stopPress(false)}
            onPointerLeave={() => stopPress(false)}
            title="5 Sekunden halten, um erweiterte Settings freizuschalten"
          >
            Einstellungen
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

        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
        >
          <RefreshCcw className="w-4 h-4" />
          Neu laden
        </button>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-200 text-sm">
        <Info className="w-4 h-4 mt-0.5" />
        <p>
          Hier konfigurierst du die Standardanzahl der zu druckenden Etiketten
          und das Start-Preset, das beim Öffnen der Labels-Ansicht automatisch
          ausgewählt werden soll.
        </p>
      </div>

      {/* Produkte abrufen */}
      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                Produkte abrufen
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Syncronisiert die Produktdaten von der Cloud.
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
            disabled={fetchingProducts}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition",
              fetchingProducts
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]",
            ].join(" ")}
          >
            <RefreshCcw className="w-4 h-4" />
            {fetchingProducts ? "Abrufen..." : "Produkte abrufen"}
          </button>
        </div>
      </section>

      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-5">
        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Standard-Etiketten pro Druck (Quantity)
          </label>
          <input
            type="number"
            min={1}
            max={9999}
            value={defaultLabelQty}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string or any number during editing
              if (value === "") {
                setDefaultLabelQty("");
              } else {
                const num = Number(value);
                if (!isNaN(num)) {
                  setDefaultLabelQty(num);
                }
              }
            }}
            onBlur={(e) => {
              // When leaving the field, set to 1 if empty or less than 1
              const value = e.target.value;
              const num = Number(value);
              if (value === "" || isNaN(num) || num < 1) {
                setDefaultLabelQty(1);
              }
            }}
            className="w-32 border border-gray-200 px-3 py-2 rounded-lg text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Wird in der Config unter{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">
              general.defaultLabelQty
            </code>{" "}
            gespeichert und in der Print-API sowohl für Text (
            <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">
              {"{{QTY}}"}
            </code>
            ) als auch für <code>^PQ</code> verwendet, wenn der Request keine
            eigene <code>qty</code> enthält.
          </p>
        </div>

        {/* Start-Preset */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Start-Preset für Labels
          </label>
          <select
            value={startPresetId}
            onChange={(e) => setStartPresetId(e.target.value)}
            className="w-full max-w-xs border border-gray-200 px-3 py-2 rounded-lg text-sm bg-white"
          >
            <option value="">– Kein spezielles Start-Preset –</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Dieses Preset wird als Standard verwendet, wenn du die Labels-Ansicht
            öffnest. Falls leer, wird z. B. das erste verfügbare Preset genutzt
            (abhängig von deiner Labels-Seite).
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-800 active:scale-[0.98] disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? "Speichern..." : "Speichern"}
        </button>

        {success && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}
