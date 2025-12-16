// app/api/products/backups/route.ts
import { NextResponse } from "next/server";
import { listBackups } from "@/app/lib/productsBackups";
import { getConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const backups = await listBackups();
    const config = await getConfig();

    const currentFromBackupId =
      (config as any).products?.currentFromBackupId || null;

    return NextResponse.json({
      ok: true,
      currentFromBackupId,
      backups,
    });
  } catch (e: any) {
    console.error("[/api/products/backups] FAILED:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to list backups" },
      { status: 500 }
    );
  }
}
