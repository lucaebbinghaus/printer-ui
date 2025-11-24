"use client";
import TouchKeyboard from "@/app/components/TouchKeyboard";
import { useEffect, useState } from "react";
import {
  Save,
  Download,
  RefreshCcw,
  Info,
  Link2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

type XanoSettings = {
  enabled: boolean;
  baseUrl: string;
  productsEndpoint: string;
  intervalMinutes: number;
  printerId: string;
  apiKey: string;
  lastSyncAt: string | null;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [productsEndpoint, setProductsEndpoint] = useState("/printer_products");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [printerId, setPrinterId] = useState("");
  const [apiKey, setApiKey] = useState("");

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
      const res = await fetch("/api/settings/xano", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json: XanoSettings = await res.json();

      setEnabled(Boolean(json.enabled));
      setBaseUrl(json.baseUrl || "");
      setProductsEndpoint(json.productsEndpoint || "/printer_products");
      setIntervalMinutes(Number(json.intervalMinutes ?? 60));
      setPrinterId(json.printerId || "");
      setApiKey(json.apiKey || "");
      setLastSyncAt(json.lastSyncAt ?? null);
    } catch {
      setError("Fehler beim Laden der Xano-Einstellungen.");
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
      const res = await fetch("/api/settings/xano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          baseUrl: baseUrl.trim(),
          productsEndpoint: productsEndpoint.trim(),
          intervalMinutes: Number(intervalMinutes),
          printerId: printerId.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg);
      }

      setSuccess("Xano-Einstellungen gespeichert.");
      await load();
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
      const res = await fetch("/api/sync/xano-products", { method: "POST" });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg);
      }

      const json = await res.json();
      setSyncResult(`Produkte abgerufen: ${json.count} Einträge.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Produkt-Sync fehlgeschlagen.");
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
        <p>
          Hier konfigurierst du den Xano-Sync. Printer ID ist dein auth_token.
        </p>
      </div>

      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">

        {/* Enabled toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div>
            <div className="text-sm font-medium text-gray-800">Xano Sync aktiv</div>
            <div className="text-xs text-gray-500">
              Wenn deaktiviert, wird kein Produktabruf durchgeführt.
            </div>
          </div>
          <button
            onClick={() => {
              setEnabled((v) => !v);
              setSuccess(null); setError(null); setSyncResult(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
            aria-label="Toggle Xano sync"
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

        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Xano Base URL
          </label>
          <input
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setSuccess(null); setError(null); setSyncResult(null);
            }}
            className="w-full border border-gray-200 px-3 py-2 rounded-lg bg-white text-sm"
            placeholder="https://api.saf-tepasse.de/api:..."
          />
          <p className="mt-1 text-xs text-gray-500">
            Beispiel: https://api.saf-tepasse.de/api:j-HmV1Vn
          </p>
        </div>

        {/* Endpoint */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Endpunkt
          </label>
          <input
            value={productsEndpoint}
            onChange={(e) => {
              setProductsEndpoint(e.target.value);
              setSuccess(null); setError(null); setSyncResult(null);
            }}
            className="w-full border border-gray-200 px-3 py-2 rounded-lg bg-white text-sm"
            placeholder="/printer_products"
          />
          <p className="mt-1 text-xs text-gray-500">
            Wird an die Base URL gehängt.
          </p>
        </div>

         {/*

       
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Sync Intervall (Minuten)
          </label>
          <input
            type="number"
            min={1}
            value={intervalMinutes}
            onChange={(e) => {
              setIntervalMinutes(Number(e.target.value || 0));
              setSuccess(null); setError(null); setSyncResult(null);
            }}
            className="w-full border border-gray-200 px-3 py-2 rounded-lg bg-white text-sm"
          />
        </div>
        */}

        {/* Printer ID */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Printer ID
          </label>
          <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg bg-white">
            <Link2 className="w-4 h-4 text-gray-500" />
            <input
              value={printerId}
              onChange={(e) => {
                setPrinterId(e.target.value);
                setSuccess(null); setError(null); setSyncResult(null);
              }}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="He1NDNzs4nWQC2uS86KC1CXaOxMtx2..."
            />
          </div>
        </div>

        {/* API Key (optional) 
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            API Key (optional)
          </label>
          <input
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setSuccess(null); setError(null); setSyncResult(null);
            }}
            className="w-full border border-gray-200 px-3 py-2 rounded-lg bg-white text-sm"
            placeholder="falls Xano Authorization braucht"
          />
        </div>
        */}

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
            {syncing ? "Abrufen..." : "Produkte abrufen"}
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
