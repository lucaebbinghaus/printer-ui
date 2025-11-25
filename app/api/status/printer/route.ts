// app/api/status/printer/route.ts
import { NextResponse } from "next/server";
import { getConfig } from "@/app/lib/storage";
import { startOpcUaWatcher, getCurrentStatus } from "@/app/lib/opcuaWatcher";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await getConfig();
    const printerIp = config.network?.printerIp?.trim();

    if (!printerIp) {
      return NextResponse.json(
        { connected: false, nodes: [], error: "Keine Printer-IP gesetzt" },
        { status: 200 }
      );
    }

    const endpoint = `opc.tcp://${printerIp}:4840/`;

    // watcher einmalig starten
    await startOpcUaWatcher(endpoint);

    // aktuellen Realtime-Status zurückgeben
    return NextResponse.json(getCurrentStatus(), { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { connected: false, nodes: [], error: e?.message || String(e) },
      { status: 200 }
    );
  }
}
