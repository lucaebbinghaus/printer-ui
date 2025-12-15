// app/settings/update/page.tsx
"use client";

import { useEffect, useState } from "react";
import { DownloadCloud, RefreshCcw } from "lucide-react";

export default function UpdatePage() {
  const [running, setRunning] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadStatus() {
    const res = await fetch("/api/update/status", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Status failed");

    setRunning(!!json.running);
    setPid(json.pid ?? null);
    setStartedAt(json.startedAt ?? null);
    setLog(String(json.log ?? ""));
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
  }, []);

  async function runUpdate() {
    setMsg(null);
    setErr(null);

    try {
      const ok = confirm(
        "Update starten?\n\nDas führt ein git pull aus und baut die Docker Container neu."
      );
      if (!ok) return;

      const res = await fetch("/api/update/run", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Update konnte nicht gestartet werden.");
      }

      setMsg("Update gestartet.");
      setPid(json.pid ?? null);
      setStartedAt(json.startedAt ?? null);
      setRunning(true);
    } catch (e: any) {
      setErr(e?.message || "Update fehlgeschlagen.");
    }
  }

  return (
    <div className="p-4 max-w-3xl space-y-4">
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
              {running ? "läuft" : "bereit"}
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
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
            >
              <RefreshCcw className="w-4 h-4" />
              Status
            </button>

            <button
              onClick={runUpdate}
              disabled={running}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition",
                running
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]",
              ].join(" ")}
            >
              <DownloadCloud className="w-4 h-4" />
              {running ? "Update läuft…" : "Update starten"}
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
