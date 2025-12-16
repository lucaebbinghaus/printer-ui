import { NextResponse } from "next/server";
import { getConfig } from "@/app/lib/storage";
import { listSnapshots, deleteSnapshot } from "@/app/lib/snapshots";

export const runtime = "nodejs";

export async function GET() {
  try {
    const backups = await listSnapshots();
    const config = await getConfig();

    const currentFromBackupId =
      (config as any)?.products?.currentFromBackupId || null;

    return NextResponse.json({
      ok: true,
      currentFromBackupId,
      backups,
    });
  } catch (e: any) {
    console.error("[/api/backups] FAILED:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to list backups" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const backupId = String(body?.backupId || "").trim();

    if (!backupId) {
      return NextResponse.json(
        { ok: false, error: "backupId missing" },
        { status: 400 }
      );
    }

    // Schutz: aktives Backup nicht löschen
    const config = await getConfig();
    const currentFromBackupId =
      (config as any)?.products?.currentFromBackupId || null;

    if (currentFromBackupId && currentFromBackupId === backupId) {
      return NextResponse.json(
        { ok: false, error: "Active backup cannot be deleted" },
        { status: 400 }
      );
    }

    await deleteSnapshot(backupId);

    return NextResponse.json({ ok: true, backupId });
  } catch (e: any) {
    console.error("[/api/backups] DELETE FAILED:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
