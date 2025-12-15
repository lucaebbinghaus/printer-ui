// app/api/update/run/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export const runtime = "nodejs";

const DATA_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), "data");
const LOG_PATH = path.join(DATA_DIR, "update.log");
const JOB_PATH = path.join(DATA_DIR, "update-job.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function isRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function POST() {
  try {
    await ensureDir();

    // Wenn Job läuft: nicht doppelt starten
    try {
      const raw = await fs.readFile(JOB_PATH, "utf8");
      const job = JSON.parse(raw);
      const pid = job?.pid ? Number(job.pid) : null;

      if (pid && (await isRunning(pid))) {
        return NextResponse.json({
          ok: false,
          running: true,
          pid,
          startedAt: job?.startedAt || null,
          error: "Update läuft bereits.",
        });
      }
    } catch {
      // ignore
    }

    // Log reset
    await fs.writeFile(LOG_PATH, "", "utf8");

    const scriptPath = path.join(process.cwd(), "scripts", "update.sh");

    const child = spawn("bash", [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PROJECT_DIR: process.cwd(),
        UPDATE_BRANCH: process.env.UPDATE_BRANCH || "main",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    child.stdout?.on("data", async (buf) => {
      try {
        await fs.appendFile(LOG_PATH, buf);
      } catch {}
    });

    child.stderr?.on("data", async (buf) => {
      try {
        await fs.appendFile(LOG_PATH, buf);
      } catch {}
    });

    const job = { pid: child.pid, startedAt: new Date().toISOString() };
    await fs.writeFile(JOB_PATH, JSON.stringify(job, null, 2), "utf8");

    child.unref();

    return NextResponse.json({ ok: true, ...job });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "unknown error" },
      { status: 500 }
    );
  }
}
