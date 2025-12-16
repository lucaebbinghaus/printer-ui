import { NextResponse } from "next/server";
import { restoreSnapshot } from "@/app/lib/snapshots";
import { getConfig, saveConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const backupId = String(body?.backupId || "").trim();

    if (!backupId) {
      return NextResponse.json(
        { ok: false, error: "backupId missing" },
        { status: 400 }
      );
    }

    await restoreSnapshot(backupId);

    // Markierung setzen (optional aber sinnvoll für UI)
    const config = await getConfig();
    const nowIso = new Date().toISOString();

    await saveConfig({
      ...config,
      products: {
        ...(config as any).products,
        currentFromBackupId: backupId,
        restoredAt: nowIso,
      },
    });

    return NextResponse.json({ ok: true, backupId });
  } catch (e: any) {
    console.error("[/api/backups/restore] FAILED:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Restore failed" },
      { status: 500 }
    );
  }
}
