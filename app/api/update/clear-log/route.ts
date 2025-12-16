import { NextResponse } from "next/server";
import fs from "node:fs/promises";

const LOG_FILE = "/opt/printer-ui/data/update.log";

export async function POST() {
  try {
    await fs.mkdir("/opt/printer-ui/data", { recursive: true });
    await fs.writeFile(LOG_FILE, "", "utf8");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "clear failed" },
      { status: 500 }
    );
  }
}
