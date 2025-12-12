import { NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

const isValidIPv4 = (ip: string) => {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
};

export async function GET() {
  try {
    const config = await getConfig();

    return NextResponse.json({
      printerIp: config.network?.printerIp || "",
    });
  } catch (e: any) {
    console.error("GET /api/settings/network failed:", e);
    return new NextResponse(`GET failed: ${e?.message}`, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nextPrinterIp = String(body.printerIp || "").trim();

    if (nextPrinterIp && !isValidIPv4(nextPrinterIp)) {
      return new NextResponse("validation error", { status: 400 });
    }

    const config = await getConfig();

    const next = {
      ...config,
      network: {
        ...(config.network || {}),
        printerIp: nextPrinterIp,
      },
    };

    await saveConfig(next);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/settings/network failed:", e);
    return new NextResponse(`POST failed: ${e?.message}`, { status: 500 });
  }
}
