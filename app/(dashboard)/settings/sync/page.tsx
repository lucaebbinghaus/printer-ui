"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Printer, Info, RefreshCcw } from "lucide-react";

type NetworkSettings = {
  printerIp: string;
};

const isValidIPv4 = (ip: string) => {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
};

export default function NetworkSettingsPage() {
  const [data, setData] = useState<NetworkSettings | null>(null);
  const [printerIp, setPrinterIp] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    resetMessages();

    try {
      const res = await fetch("/api/settings/network", { cache: "no-store" });
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      const json: NetworkSettings = await res.json();

      setData(json);
      setPrinterIp(json.printerIp ?? "");
    } catch {
      setError("Konnte Netzwerk-Einstellungen nicht laden.");
    } finally {
      setLoading(false);
    }
  }, [resetMessages]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const printerIpValid = useMemo(
    () => printerIp.length === 0 || isValidIPv4(printerIp),
    [printerIp]
  );

  const hasChanges = useMemo(() => {
    if (!data) return false;
    return (data.printerIp ?? "") !== printerIp;
  }, [data, printerIp]);

  const canSave = printerIpValid && hasChanges && !saving;

  const saveSettings = useCallback(async () => {
    setSaving(true);
    resetMessages();

    try {
      const payload = { printerIp: printerIp.trim() };

      const res = await fetch("/api/settings/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `POST failed: ${res.status}`);
      }

      setSuccess("Gespeichert.");
      await loadSettings();
    } catch (e: any) {
      setError(
        e?.message?.includes("validation")
          ? "Bitte eine gültige Drucker-IP eingeben."
          : e?.message || "Speichern fehlgeschlagen."
      );
    } finally {
      setSaving(false);
    }
  }, [printerIp, resetMessages, loadSettings]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="max-w-3xl">
          <div className="animate-pulse rounded-xl border bg-white p-6 shadow-sm">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="mt-4 h-10 w-full rounded bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Netzwerk</h1>
          <button
            onClick={loadSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
          >
            <RefreshCcw className="h-4 w-4" />
            Neu laden
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4" />
          <div>Hier konfigurierst du nur die Drucker-IP.</div>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Drucker-IP
              </label>
              <div
                className={[
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  printerIpValid
                    ? "border-gray-200 bg-white"
                    : "border-red-300 bg-red-50",
                ].join(" ")}
              >
                <Printer className="h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => {
                    setPrinterIp(e.target.value);
                    resetMessages();
                  }}
                  placeholder="z. B. 192.168.10.20"
                  className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                  inputMode="decimal"
                />
              </div>

              {!printerIpValid && (
                <p className="mt-1 text-xs text-red-600">
                  Bitte eine gültige IPv4-Adresse eingeben.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Änderungen werden sofort in der Konfiguration gespeichert.
            </div>

            <button
              onClick={saveSettings}
              disabled={!canSave}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition",
                canSave
                  ? "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed",
              ].join(" ")}
            >
              <Save className="h-4 w-4" />
              {saving ? "Speichern..." : "Speichern"}
            </button>
          </div>

          {(error || success) && (
            <div className="mt-4 space-y-2">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  {success}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
