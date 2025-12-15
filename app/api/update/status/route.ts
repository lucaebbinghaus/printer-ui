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
    // systemd state details (robust for oneshot)
    const show = await execText(
      "sudo -n /bin/systemctl show printer-ui-update.service " +
        "-p ActiveState -p SubState -p Result -p ExecMainStatus -p ExecMainCode -p ExecMainStartTimestamp -p ExecMainExitTimestamp || true"
    );

    const state: Record<string, string> = {};
    for (const line of show.split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) state[line.slice(0, i)] = line.slice(i + 1);
    }

    const running = state.ActiveState === "active" && state.SubState === "running";

    // Logs (letzte 200 Zeilen)
    const log = await execText(
      "sudo -n /bin/journalctl -u printer-ui-update.service -n 200 --no-pager || true"
    );

    return NextResponse.json({
      ok: true,
      running,
      state,
      log,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "status failed" },
      { status: 500 }
    );
  }
}
