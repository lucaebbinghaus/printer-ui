// app/api/update/status/route.ts
import { NextResponse } from "next/server";
import { exec } from "child_process";

export const runtime = "nodejs";

function execText(cmd: string) {
  return new Promise<string>((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout || "");
    });
  });
}

export async function GET() {
  try {
    // running?
    const active = (await execText(
      "sudo -n /bin/systemctl is-active printer-ui-update.service || true"
    )).trim();

    // Logs (letzte 200 Zeilen)
    const log = await execText(
      "sudo -n /bin/journalctl -u printer-ui-update.service -n 200 --no-pager || true"
    );

    return NextResponse.json({
      ok: true,
      running: active === "active",
      log,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "status failed" },
      { status: 500 }
    );
  }
}
