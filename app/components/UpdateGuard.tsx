"use client";

import { useEffect, useMemo, useState } from "react";

type StatusResponse = {
  ok: boolean;
  running?: boolean;
  pid?: number | null;
  log?: string;
};

function parseProgress(log: string) {
  const matches = log.match(/\[(\d+)\s*\/\s*(\d+)\]/g);
  const last = matches?.at(-1);
  if (!last) return { step: 0, total: 10, pct: 0 };

  const mm = last.match(/\[(\d+)\s*\/\s*(\d+)\]/);
  const step = mm ? Number(mm[1]) : 0;
  const total = mm ? Number(mm[2]) : 10;
  const pct =
    total > 0 ? Math.min(100, Math.max(0, Math.round((step / total) * 100))) : 0;

  return { step, total, pct };
}

export default function UpdateGuard() {
  const [running, setRunning] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [log, setLog] = useState("");

  const progress = useMemo(() => parseProgress(log), [log]);

  useEffect(() => {
    let statusIntervalId: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      try {
        const res = await fetch("/api/update/status", { cache: "no-store" });
        const json: StatusResponse = await res.json().catch(() => ({ ok: false } as any));
        if (!res.ok || !json?.ok) return;

        const isRunning = !!json.running;
        setRunning(isRunning);
        setPid(json.pid ?? null);
        setLog(String(json.log ?? ""));
      } catch {
        // ignore
      }
    }

    tick();
    statusIntervalId = setInterval(tick, 1200);
    
    return () => {
      if (statusIntervalId) {
        clearInterval(statusIntervalId);
        statusIntervalId = null;
      }
    };
  }, []);

  if (!running) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white/70 backdrop-blur-[2px] flex items-center justify-center">
      <div className="w-[min(520px,92%)] rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <div className="text-sm text-gray-900 font-semibold">
            Update läuft – App ist gesperrt
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Fortschritt</span>
            <span>
              {progress.step}/{progress.total} ({progress.pct}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-2 bg-gray-900" style={{ width: `${progress.pct}%` }} />
          </div>
          {pid ? <div className="text-xs text-gray-500">PID: {pid}</div> : null}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-[220px] overflow-auto">
          <pre className="text-xs whitespace-pre-wrap break-words">{log || "—"}</pre>
        </div>
      </div>
    </div>
  );
}
