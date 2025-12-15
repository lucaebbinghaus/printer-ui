// app/api/update/status/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), "data");
const LOG_PATH = path.join(DATA_DIR, "update.log");
const JOB_PATH = path.join(DATA_DIR, "update-job.json");

async function isRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tailLines(text: string, maxLines: number): string {
  const lines = text.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - maxLines)).join("\n");
}

export async function GET() {
  try {
    let job: any = null;
    try {
      job = JSON.parse(await fs.readFile(JOB_PATH, "utf8"));
    } catch {
      job = null;
    }

    let log = "";
    try {
      log = await fs.readFile(LOG_PATH, "utf8");
    } catch {
      log = "";
    }

    const pid = job?.pid ? Number(job.pid) : null;
    const running = pid ? await isRunning(pid) : false;

    return NextResponse.json({
      ok: true,
      running,
      pid,
      startedAt: job?.startedAt || null,
      log: tailLines(log || "", 300),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "unknown error" },
      { status: 500 }
    );
  }
}
