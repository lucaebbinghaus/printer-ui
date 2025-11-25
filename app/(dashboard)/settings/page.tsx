"use client";

import { useEffect, useState } from "react";
import { Save, RefreshCcw, Info } from "lucide-react";
import KeyboardInput from "@/app/components/KeyboardInput";

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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [defaultLabelQty, setDefaultLabelQty] = useState<number>(1);
  const [startPresetId, setStartPresetId] = useState<string | "">("");

  const [presets, setPresets] = useState<PresetSummary[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  if (loading) {
    return <div className="p-4">Lade Einstellungen…</div>;
  }

  return (
    <div className="p-4 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Einstellungen</h1>
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
            onChange={(e) =>
              setDefaultLabelQty(Math.max(1, Number(e.target.value) || 1))
            }
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
