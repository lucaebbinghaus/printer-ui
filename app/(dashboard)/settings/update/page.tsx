"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DownloadCloud,
  RefreshCcw,
  Trash2,
  GitCommit,
  FileText,
} from "lucide-react";

type UpdateStatus = {
  ok: boolean;
  running: boolean;
  pid?: number | null;
  startedAt?: string | null;
  log?: string;
};

type CheckResponse = {
  ok: boolean;
  branch: string;
  head: string;
  remote: string;
  behind: number;
  commits: Array<{
    sha: string;
    subject: string;
    author: string;
    date: string;
  }>;
  files?: string[];
  error?: string;
};

function parseProgress(log: string) {
  // Matches like: [8/10]
  const m = log.match(/\[(\d+)\s*\/\s*(\d+)\]/g);
  const last = m?.at(-1);
  if (!last) return { step: 0, total: 10, pct: 0 };
  const mm = last.match(/\[(\d+)\s*\/\s*(\d+)\]/);
  const step = mm ? Number(mm[1]) : 0;
  const total = mm ? Number(mm[2]) : 10;
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((step / total) * 100))) : 0;
  return { step, total, pct };
}

export default function UpdatePage() {
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [check, setCheck] = useState<CheckResponse | null>(null);
  const [checking, setChecking] = useState(false);

  const busy = running || starting;

  const logRef = useRef<HTMLPreElement | null>(null);
  const logWrapRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const prevRunningRef = useRef<boolean>(false);

  const progress = useMemo(() => parseProgress(log || ""), [log]);

  async function loadStatus() {
    const res = await fetch("/api/update/status", { cache: "no-store" });
    const json: UpdateStatus = await res.json().catch(() => ({ ok: false } as any));
    if (!res.ok || !json?.ok) throw new Error((json as any)?.error || "Status failed");

    const isRunning = !!json.running;

    setRunning(isRunning);
    setPid((json as any).pid ?? null);
    setStartedAt((json as any).startedAt ?? null);
    setLog(String((json as any).log ?? ""));

    // starting -> running bestätigt
    if (starting && isRunning) setStarting(false);

    // Transition: running -> false
    if (prevRunningRef.current && !isRunning) {
      const l = String((json as any).log ?? "");
      const isSuccess =
        /UPDATE DONE/i.test(l) &&
        !/ERROR|FAILED|Exit code|Traceback/i.test(l);

      if (isSuccess) {
        setMsg("Update erfolgreich abgeschlossen.");
        setErr(null);
      } else {
        setErr("Update beendet, aber offenbar fehlgeschlagen. Bitte Logs prüfen.");
        setMsg(null);
      }
    }

    prevRunningRef.current = isRunning;
  }

  async function loadCheck() {
    setChecking(true);
    try {
      const res = await fetch("/api/update/check", { cache: "no-store" });
      const json: CheckResponse = await res.json().catch(() => ({ ok: false } as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Update-Check fehlgeschlagen");
      setCheck(json);
    } catch (e: any) {
      setCheck(null);
      setErr(e?.message || "Update-Check fehlgeschlagen.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    let t: any;

    (async () => {
      try {
        await loadStatus();
      } catch (e: any) {
        setErr(e?.message || "Status konnte nicht geladen werden.");
      }

      // Beim Öffnen der Seite direkt checken (wenn nicht gerade busy)
      try {
        await loadCheck();
      } catch {}

      t = setInterval(async () => {
        try {
          await loadStatus();
        } catch {}
      }, 1500);
    })();

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll (nur wenn enabled und User nicht hochgescrollt hat)
  useEffect(() => {
    if (!autoScroll) return;
    const el = logWrapRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log, autoScroll]);

  function onLogScroll() {
    const el = logWrapRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setAutoScroll(atBottom);
  }

  async function runUpdate() {
    setMsg(null);
    setErr(null);

    try {
      const ok = confirm(
        "Update starten?\n\nDas zieht den neuesten Stand und baut die Docker Container neu. Währenddessen wird die App gesperrt."
      );
      if (!ok) return;

      setStarting(true);

      const res = await fetch("/api/update/run", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) throw new Error(json?.error || "Update konnte nicht gestartet werden.");

      setMsg("Update gestartet.");
      setPid(json.pid ?? null);
      setStartedAt(json.startedAt ?? null);
      setRunning(true);

      // sofort Status + Check refresh
      try { await loadStatus(); } catch {}
      try { await loadCheck(); } catch {}
    } catch (e: any) {
      setStarting(false);
      setErr(e?.message || "Update fehlgeschlagen.");
    }
  }

  async function clearLogs() {
    setMsg(null);
    setErr(null);
    const ok = confirm("Logs wirklich löschen?");
    if (!ok) return;

    try {
      const res = await fetch("/api/update/clear-log", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Logs konnten nicht gelöscht werden.");
      setLog("");
      setMsg("Logs wurden gelöscht.");
    } catch (e: any) {
      setErr(e?.message || "Logs konnten nicht gelöscht werden.");
    }
  }

  return (
    <div className="p-4 max-w-3xl space-y-4 relative">
      {/* Overlay nur für diese Page (Global Freeze siehe unten UpdateGuard) */}
      {busy ? (
        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
          <div className="w-[min(420px,90%)] rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              <div className="text-sm text-gray-800 font-medium">
                {starting ? "Update wird gestartet…" : "Update läuft…"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Fortschritt</span>
                <span>{progress.step}/{progress.total} ({progress.pct}%)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-2 bg-gray-900" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>

            <div className="text-xs text-gray-600">
              {pid ? <>PID: <span className="font-semibold">{pid}</span></> : null}
              {startedAt ? <span className="ml-2">Start: {startedAt}</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="text-lg font-semibold">Update</h1>
        <p className="mt-1 text-sm text-gray-600">
          Prüft GitHub auf neue Commits und führt anschließend das Update-Script aus.
        </p>
      </div>

      {/* Updates verfügbar */}
      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700 font-semibold">Verfügbarkeit</div>

          <button
            onClick={loadCheck}
            disabled={busy || checking}
            className={[
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition",
              busy || checking
                ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98]",
            ].join(" ")}
          >
            <RefreshCcw className="w-4 h-4" />
            {checking ? "Prüfe…" : "Nach Updates prüfen"}
          </button>
        </div>

        {check ? (
          <div className="text-sm text-gray-700">
            Branch: <span className="font-semibold">{check.branch}</span>{" "}
            {check.behind > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-800 text-xs">
                {check.behind} neue Commits verfügbar
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-green-800 text-xs">
                Up-to-date
              </span>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500">—</div>
        )}

        {check?.behind ? (
          <div className="grid gap-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <GitCommit className="w-4 h-4" />
                Commits (neu)
              </div>
              <div className="space-y-2">
                {check.commits.slice(0, 20).map((c) => (
                  <div key={c.sha} className="text-xs text-gray-700">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">{c.sha.slice(0, 8)}</span>
                      <span className="text-gray-500">{c.date} · {c.author}</span>
                    </div>
                    <div className="mt-0.5">{c.subject}</div>
                  </div>
                ))}
              </div>
            </div>

            {check.files?.length ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Geänderte Dateien (neu)
                </div>
                <pre className="text-xs whitespace-pre-wrap break-words max-h-[220px] overflow-auto">
                  {check.files.map((f) => `- ${f}`).join("\n")}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Status + Controls + Logs */}
      <section className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            Status: <span className="font-semibold">{busy ? "läuft" : "bereit"}</span>
            {pid ? <span className="ml-2 text-gray-500">PID: {pid}</span> : null}
            {startedAt ? <span className="ml-2 text-gray-500">Start: {startedAt}</span> : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setErr(null);
                setMsg(null);
                try { await loadStatus(); } catch {}
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
              disabled={busy || (check?.behind === 0 && !!check)}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition",
                busy
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]",
                (check?.behind === 0 && !!check && !busy) ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              title={check?.behind === 0 ? "Keine neuen Updates verfügbar" : "Update starten"}
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

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Auto-Scroll:{" "}
            <span className={autoScroll ? "text-gray-900 font-semibold" : ""}>
              {autoScroll ? "an" : "aus (hochgescrollt)"}
            </span>
          </div>

          <button
            onClick={clearLogs}
            disabled={busy}
            className={[
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition",
              busy
                ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98]",
            ].join(" ")}
          >
            <Trash2 className="w-4 h-4" />
            Logs löschen
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50">
          <div className="px-3 pt-3 text-xs font-semibold text-gray-600 mb-2">
            Log (live)
          </div>
          <div
            ref={logWrapRef}
            onScroll={onLogScroll}
            className="px-3 pb-3 max-h-[520px] overflow-auto"
          >
            <pre ref={logRef} className="text-xs whitespace-pre-wrap break-words">
              {log || "—"}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
