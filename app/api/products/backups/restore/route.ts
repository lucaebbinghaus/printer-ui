// app/api/products/backups/restore/route.ts
import { NextResponse } from "next/server";
import {
  createBackupFromCurrentProducts,
  pruneBackupsKeepLatest,
  restoreBackupToProducts,
} from "@/app/lib/productsBackups";
import { readProducts, computeProductsHash } from "@/app/lib/productsStore";
import { getConfig, saveConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const backupId = String(body?.backupId || "").trim();
    if (!backupId) {
      return new NextResponse("backupId missing.", { status: 400 });
    }

    const config = await getConfig();

    // Sicherheits-Backup vom aktuellen Stand, bevor restore überschreibt
    const safetyBackup = await createBackupFromCurrentProducts();
    await pruneBackupsKeepLatest(10);

    // Restore durchführen
    await restoreBackupToProducts(backupId);

    // Hash neu berechnen
    const current = await readProducts();
    const hash = computeProductsHash(current);

    await saveConfig({
      ...config,
      products: {
        ...(config as any).products,
        currentHash: hash,
        currentFromBackupId: backupId,
        lastRestoreAt: new Date().toISOString(),
        safetyBackupId: safetyBackup?.id || null,
      },
    });

    return NextResponse.json({
      ok: true,
      restoredBackupId: backupId,
      hash,
      safetyBackupCreated: safetyBackup?.id || null,
    });
  } catch (err: any) {
    return new NextResponse(
      `Restore failed: ${err?.message || "unknown error"}`,
      { status: 500 }
    );
  }
}
