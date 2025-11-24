"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Wifi, Printer, Info, RefreshCcw } from "lucide-react";

type NetworkSettings = {
  deviceIpCurrent: string;   // read-only detected current IP
  deviceIpConfig: string;    // configurable target IP
  printerIp: string;         // configurable printer IP
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

  const [deviceIpConfig, setDeviceIpConfig] = useState("");
  const [printerIp, setPrinterIp] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/settings/network", { cache: "no-store" });
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      const json: NetworkSettings = await res.json();

      setData(json);
      setDeviceIpConfig(json.deviceIpConfig ?? "");
      setPrinterIp(json.printerIp ?? "");
    } catch (e: any) {
      setError("Konnte Netzwerk-Einstellungen nicht laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const deviceIpConfigValid = useMemo(
    () => deviceIpConfig.length === 0 || isValidIPv4(deviceIpConfig),
    [deviceIpConfig]
  );
  const printerIpValid = useMemo(
    () => printerIp.length === 0 || isValidIPv4(printerIp),
    [printerIp]
  );

  const canSave = deviceIpConfigValid && printerIpValid && !saving;

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/settings/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceIpConfig: deviceIpConfig.trim(),
          printerIp: printerIp.trim(),
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `POST failed: ${res.status}`);
      }

      setSuccess("Gespeichert. Änderungen werden ggf. nach kurzer Zeit aktiv.");
      await loadSettings();
    } catch (e: any) {
      setError(
        e?.message?.includes("validation")
          ? "Bitte gültige IP-Adressen eingeben."
          : "Speichern fehlgeschlagen."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="max-w-3xl">
          <div className="animate-pulse rounded-xl border bg-white p-6 shadow-sm">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="mt-4 h-10 w-full rounded bg-gray-100" />
            <div className="mt-3 h-10 w-full rounded bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="max-w-3xl space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            Netzwerk
          </h1>

          <button
            onClick={loadSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
          >
            <RefreshCcw className="h-4 w-4" />
            Neu laden
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4" />
          <div>
            Hier kannst du die IP-Adressen des Raspberry Pi (Gerät) und des Druckers
            konfigurieren. Die aktuell erkannte Geräte-IP wird nur angezeigt.
          </div>
        </div>

        {/* Card */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Current device ip (read-only) */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Aktuelle Geräte-IP (Raspberry Pi)
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <Wifi className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-800">
                  {data?.deviceIpCurrent || "unbekannt"}
                </span>
              </div>
            </div>

            {/* Device config ip */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Geräte-IP (Konfiguration)
              </label>
              <div
                className={[
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  deviceIpConfigValid
                    ? "border-gray-200 bg-white"
                    : "border-red-300 bg-red-50",
                ].join(" ")}
              >
                <Wifi className="h-4 w-4 text-gray-500" />
                <input
                  value={deviceIpConfig}
                  onChange={(e) => {
                    setDeviceIpConfig(e.target.value);
                    setSuccess(null);
                  }}
                  placeholder="z. B. 192.168.1.50"
                  className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                />
              </div>
              {!deviceIpConfigValid && (
                <p className="mt-1 text-xs text-red-600">
                  Bitte eine gültige IPv4-Adresse eingeben.
                </p>
              )}
            </div>

            {/* Printer ip */}
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
                  value={printerIp}
                  onChange={(e) => {
                    setPrinterIp(e.target.value);
                    setSuccess(null);
                  }}
                  placeholder="z. B. 192.168.1.60"
                  className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                />
              </div>
              {!printerIpValid && (
                <p className="mt-1 text-xs text-red-600">
                  Bitte eine gültige IPv4-Adresse eingeben.
                </p>
              )}
            </div>
          </div>

          {/* Footer row */}
          <div className="mt-5 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Änderungen an der Geräte-IP können einen Neustart/Netzwerk-Reconnect erfordern.
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

          {/* Status messages */}
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
