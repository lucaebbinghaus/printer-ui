// app/api/status/printer/stream/route.ts
import { NextResponse } from "next/server";
import { getConfig } from "@/app/lib/storage";
import {
  startOpcUaWatcher,
  getCurrentStatus,
  subscribeToStatus,
  PrinterStatus,
} from "@/app/lib/opcuaWatcher";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const config = await getConfig();
    const printerIp = config.network?.printerIp?.trim();

    if (!printerIp) {
      return new NextResponse("Keine Printer-IP gesetzt", { status: 400 });
    }

    const endpoint = `opc.tcp://${printerIp}:4840/`;
    await startOpcUaWatcher(endpoint);

    const encoder = new TextEncoder();
    const abortSignal = req.signal;

    const stream = new ReadableStream({
      start(controller) {
        function send(status: PrinterStatus) {
          const chunk = `data: ${JSON.stringify(status)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }

        // initialer Status
        send(getCurrentStatus());

        const unsubscribe = subscribeToStatus((status) => {
          send(status);
        });

        // keep-alive-Kommentare alle 15s
        const keepAliveId = setInterval(() => {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        }, 15000);

        const close = () => {
          clearInterval(keepAliveId);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // ignore
          }
        };

        abortSignal.addEventListener("abort", () => {
          close();
        });
      },
      cancel() {
        // wird von close() oben getriggert
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    return new NextResponse(
      `SSE error: ${e?.message || String(e)}`,
      { status: 500 }
    );
  }
}
