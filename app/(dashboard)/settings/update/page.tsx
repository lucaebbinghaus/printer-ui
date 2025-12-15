// app/settings/update/page.tsx
"use client";

import { useEffect, useState } from "react";
import { DownloadCloud, RefreshCcw } from "lucide-react";

export default function UpdatePage() {
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false); // <-- neu: UI Loading beim Start
  const [pid, setPid] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const busy = running || starting; // <-- neu: einheitlicher Busy-State für UI

  async function loadStatus() {
    const res = await fetch("/api/update/status", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Status failed");

    const isRunning = !!json.running;

    setRunning(isRunning);
    setPid(json.pid ?? null);
    setStartedAt(json.startedAt ?? null);
    setLog(String(json.log ?? ""));

    // Wenn wir gerade "starting" sind und der Status bestätigt jetzt "running",
    // dann UI-Loading beenden.
    if (starting && isRunning) setStarting(false);
  }

  useEffect(() => {
    let t: any;

    (async () => {
      try {
        await loadStatus();
      } catch (e: any) {
        setErr(e?.message || "Status konnte nicht geladen werden.");
      }

      t = setInterval(async () => {
        try {
          await loadStatus();
        } catch {}
      }, 2000);
    })();

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // bewusst nur einmal

  async function runUpdate() {
    setMsg(null);
    setErr(null);

    try {
      const ok = confirm(
        "Update starten?\n\nDas führt ein git pull aus und baut die Docker Container neu."
      );
      if (!ok) return;

      // UI sofort auf "loading" setzen
      setStarting(true);

      const res = await fetch("/api/update/run", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Update konnte nicht gestartet werden.");
      }

      setMsg("Update gestartet.");
      setPid(json.pid ?? null);
      setStartedAt(json.startedAt ?? null);

      // Optimistisch UI als running setzen (damit Status sofort "läuft" zeigt)
      setRunning(true);

      // Optional: Direkt einmal Status nachziehen (damit Log schneller kommt)
      try {
        await loadStatus();
      } catch {}
    } catch (e: any) {
      setStarting(false);
      setErr(e?.message || "Update fehlgeschlagen.");
    }
  }

  return (
    <div className="p-4 max-w-3xl space-y-4 relative">
      {/* Optionales Overlay während busy */}
      {busy ? (
        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            <div className="text-sm text-gray-700">
              {starting ? "Update wird gestartet…" : "Update läuft…"}
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="text-lg font-semibold">Update</h1>
        <p className="mt-1 text-sm text-gray-600">
          Zieht Updates von GitHub und baut die Docker Container neu (Script:
          <code className="ml-1 bg-gray-100 px-1 py-0.5 rounded text-[12px]">
            scripts/update.sh
          </code>
          ).
        </p>
      </div>

      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            Status:{" "}
            <span className="font-semibold">
              {busy ? "läuft" : "bereit"}
            </span>
            {pid ? <span className="ml-2 text-gray-500">PID: {pid}</span> : null}
            {startedAt ? (
              <span className="ml-2 text-gray-500">Start: {startedAt}</span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  await loadStatus();
                } catch {}
              }}
              disabled={busy}
              className={[
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition",
                busy
                  ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98]",
              ].join(" ")}
            >
              <RefreshCcw className="w-4 h-4" />
              Status
            </button>

            <button
              onClick={runUpdate}
              disabled={busy}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition",
                busy
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]",
              ].join(" ")}
            >
              <DownloadCloud className="w-4 h-4" />
              {starting ? "Starte…" : running ? "Update läuft…" : "Update starten"}
            </button>
          </div>
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

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-600 mb-2">
            Log (letzte Zeilen)
          </div>
          <pre className="text-xs whitespace-pre-wrap break-words max-h-[420px] overflow-auto">
            {log || "—"}
          </pre>
        </div>
      </section>
    </div>
  );
}
