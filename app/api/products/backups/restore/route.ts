// app/api/products/backups/restore/route.ts
import { NextResponse } from "next/server";
import { restoreBackupToProducts } from "@/app/lib/productsBackups";
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

    // Restore überschreibt products.json (KEIN Sicherheits-Backup mehr!)
    await restoreBackupToProducts(backupId);

    // Config markieren, dass aktueller Stand aus einem Backup stammt
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
    console.error("[/api/products/backups/restore] FAILED:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Restore failed" },
      { status: 500 }
    );
  }
}
