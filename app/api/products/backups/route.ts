// app/api/products/backups/route.ts
import { NextResponse } from "next/server";
import { listBackups } from "@/app/lib/productsBackups";
import { getConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const backups = await listBackups();
  const config = await getConfig();
  const currentFromBackupId = (config as any).products?.currentFromBackupId || null;

  return NextResponse.json({
    ok: true,
    currentFromBackupId,
    backups,
  });
}
