"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Download,
  RefreshCcw,
  Info,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
} from "lucide-react";

type SupabaseSettings = {
  enabled: boolean;
  endpointUrl: string;
  apiKey: string;
  lastSyncAt: string | null;
};

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSyncResult(null);

    try {
      const res = await fetch("/api/settings/supabase", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json: SupabaseSettings = await res.json();

      setEnabled(Boolean(json.enabled));
      setEndpointUrl(json.endpointUrl || "");
      setApiKey(json.apiKey || "");
      setLastSyncAt(json.lastSyncAt ?? null);
    } catch {
      setError("Fehler beim Laden der Supabase-Einstellungen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setSyncResult(null);

    try {
      const res = await fetch("/api/settings/supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          endpointUrl: endpointUrl.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg);
      }

      setSuccess("Supabase-Einstellungen gespeichert.");
      await load();

      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function syncProducts() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/sync/supabase-presets", { method: "POST" });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg);
      }

      const json = await res.json();
      setSyncResult(`Presets abgerufen: ${json.count} Einträge.`);

      await load();
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Preset-Sync fehlgeschlagen.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <div className="p-4">Lade...</div>;

  return (
    <div className="p-4 max-w-3xl space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Einstellungen</h1>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
        >
          <RefreshCcw className="w-4 h-4" /> Neu laden
        </button>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-200 text-sm">
        <Info className="w-4 h-4 mt-0.5" />
        <p>Hier konfigurierst du den Supabase-Sync für Presets und Produkte.</p>
      </div>

      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
        {/* Enabled toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div>
            <div className="text-sm font-medium text-gray-800">
              Supabase Sync aktiv
            </div>
            <div className="text-xs text-gray-500">
              Wenn deaktiviert, wird kein Produktabruf durchgeführt.
            </div>
          </div>
          <button
            onClick={() => {
              setEnabled((v) => !v);
              setSuccess(null);
              setError(null);
              setSyncResult(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
            aria-label="Toggle Supabase sync"
          >
            {enabled ? (
              <>
                <ToggleRight className="h-5 w-5 text-green-600" />
                An
              </>
            ) : (
              <>
                <ToggleLeft className="h-5 w-5 text-gray-500" />
                Aus
              </>
            )}
          </button>
        </div>

        {/* Endpoint URL */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Supabase Endpoint URL
          </label>
          <input
            type="text"
            value={endpointUrl}
            onChange={(e) => {
              setEndpointUrl(e.target.value);
              setSuccess(null);
              setError(null);
              setSyncResult(null);
            }}
            className="w-full border border-gray-200 px-3 py-2 rounded-lg bg-white text-sm"
            placeholder="https://kzwiyvrkklajghuiwngj.supabase.co/functions/v1/get-printer-preset-payload"
          />
          <p className="mt-1 text-xs text-gray-500">
            Vollständige URL zur Supabase Edge Function.
          </p>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setSuccess(null);
                setError(null);
                setSyncResult(null);
              }}
              className="w-full border border-gray-200 px-3 py-2 pr-10 rounded-lg bg-white text-sm"
              placeholder="sb_publishable_..."
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
              aria-label={showApiKey ? "API Key verbergen" : "API Key anzeigen"}
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Supabase publishable API Key.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-800 active:scale-[0.98] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? "Speichern..." : "Speichern"}
          </button>

          <button
            onClick={syncProducts}
            disabled={syncing}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {syncing ? "Abrufen..." : "Presets abrufen"}
          </button>
        </div>

        {/* Status */}
        {lastSyncAt && (
          <div className="text-xs text-gray-500">
            Letzter Sync: {new Date(lastSyncAt).toLocaleString("de-DE")}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}
        {syncResult && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {syncResult}
          </div>
        )}
      </section>
    </div>
  );
}
