// app/api/update/run/route.ts
import { NextResponse } from "next/server";
import { exec } from "child_process";

export const runtime = "nodejs";

function runCmd(cmd: string) {
  return new Promise<void>((resolve, reject) => {
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

export async function POST() {
  try {
    // startet Update auf dem HOST (über sudoers NOPASSWD)
    await runCmd("sudo -n /bin/systemctl start printer-ui-update.service");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          "Could not start update service. Check sudoers + systemd service.",
      },
      { status: 500 }
    );
  }
}
