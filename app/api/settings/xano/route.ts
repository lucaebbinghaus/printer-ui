import { NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/app/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const config = await getConfig();
  const xano = config.sync.xano;

  return NextResponse.json({
    enabled: xano.enabled,
    baseUrl: xano.baseUrl,
    apiKey: xano.apiKey,
    productsEndpoint: xano.productsEndpoint,
    intervalMinutes: xano.intervalMinutes,
    lastSyncAt: xano.lastSyncAt,
    printerId: xano.printerId,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const config = await getConfig();
  const x = config.sync.xano;

  const next = {
    ...config,
    sync: {
      ...config.sync,
      xano: {
        ...x,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : x.enabled,
        baseUrl: body.baseUrl !== undefined ? String(body.baseUrl).trim() : x.baseUrl,
        apiKey: body.apiKey !== undefined ? String(body.apiKey).trim() : x.apiKey,
        productsEndpoint:
          body.productsEndpoint !== undefined
            ? String(body.productsEndpoint).trim()
            : x.productsEndpoint,
        intervalMinutes:
          body.intervalMinutes !== undefined
            ? Number(body.intervalMinutes)
            : x.intervalMinutes,
        printerId:
          body.printerId !== undefined
            ? String(body.printerId).trim()
            : x.printerId,
      },
    },
  };

  await saveConfig(next);
  return NextResponse.json({ ok: true });
}
