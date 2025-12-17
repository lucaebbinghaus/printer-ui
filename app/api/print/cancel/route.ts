// app/api/printer/cancel/route.ts
import { NextResponse } from "next/server";
import net from "net";
import { getConfig } from "@/app/lib/storage";
import { buildLabelHtml } from "@/app/lib/buildLabelHtml";
import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
} from "node-opcua";

export const runtime = "nodejs";

// HIER bitte die NodeId des "Interpreter"-Objektes eintragen.
// In UAExpert: Rechtsklick auf "Interpreter" → Attributes → NodeId kopieren.
const INTERPRETER_OBJECT_NODEID = "ns=3;i=10005"; // TODO: anpassen
const TOTAL_CANCEL_METHOD_NODEID = "ns=3;i=6007";

function injectQuantity(zpl: string, quantity: number): string {
  if (quantity <= 1) return zpl;

  const idx = zpl.indexOf("^XA");
  if (idx === -1) {
    return zpl;
  }

  const insertPos = idx + 3;
  const pqCommand = `^PQ${quantity}\n`;

  return zpl.slice(0, insertPos) + pqCommand + zpl.slice(insertPos);
}

async function sendZplToPrinter({
  host,
  port,
  zpl,
  copies,
}: {
  host: string;
  port: number;
  zpl: string;
  copies: number;
}): Promise<void> {
  const copiesSafe = Math.max(1, Number(copies) || 1);
  const zplWithQuantity = injectQuantity(zpl, copiesSafe);

  console.log(
    `[CANCEL] sending empty label to printer ${host}:${port} with copies=${copiesSafe}`
  );

  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(zplWithQuantity, "ascii", () => {
        socket.end();
      });
    });

    socket.on("error", (err: Error) => {
      console.error("[CANCEL] TCP error:", err);
      reject(err);
    });

    socket.on("end", () => {
      console.log("[CANCEL] TCP connection closed by printer");
      resolve();
    });
  });
}

export async function POST() {
  try {
    const config = await getConfig();
    const printerIp = config.network?.printerIp?.trim();

    if (!printerIp) {
      return NextResponse.json(
        { ok: false, error: "Keine Printer-IP konfiguriert." },
        { status: 400 }
      );
    }

    if (INTERPRETER_OBJECT_NODEID.includes("XXXX")) {
      return NextResponse.json(
        { ok: false, error: "Interpreter-NodeId ist noch nicht konfiguriert." },
        { status: 500 }
      );
    }

    const endpointUrl = `opc.tcp://${printerIp}:4840/`;
    console.log("[CANCEL] connecting to", endpointUrl);

    const client = OPCUAClient.create({
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
      endpointMustExist: false,
    });

    await client.connect(endpointUrl);
    const session = await client.createSession();

    console.log("[CANCEL] calling TotalCancel ...");

    const result = await session.call({
      objectId: INTERPRETER_OBJECT_NODEID,
      methodId: TOTAL_CANCEL_METHOD_NODEID,
      inputArguments: [],
    });

    console.log("[CANCEL] call result:", result.statusCode.toString());

    const ok = result.statusCode.name === "Good";

    await session.close();
    await client.disconnect();

    // After canceling, print an empty label to clear the print unit
    if (ok) {
      try {
        console.log("[CANCEL] printing empty label to clear print unit...");
        
        const emptyLabelHtml = buildLabelHtml({
          name: "",
          artNumber: "",
          weight: "",
          mhd: "",
          ingredientsHtml: "",
          barcodeData: "",
          description: "",
        });

        const dataBase64 = Buffer.from(emptyLabelHtml, "utf8").toString("base64");

        const zplboxUrl = process.env.ZPLBOX_URL ?? "http://zplbox:8080";
        const zplboxEndpoint = `${zplboxUrl}/v1/html2zpl`;

        const renderRes = await fetch(zplboxEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            widthPts: 685,
            heightPts: 1010,
            orientation: "Rotate0",
            dataBase64,
          }),
        });

        if (renderRes.ok) {
          const zplCode = await renderRes.text();
          const printerPort = 9100;

          await sendZplToPrinter({
            host: printerIp,
            port: printerPort,
            zpl: zplCode,
            copies: 1,
          });

          console.log("[CANCEL] empty label printed successfully");
        } else {
          console.warn("[CANCEL] failed to render empty label, but cancel was successful");
        }
      } catch (clearError: any) {
        // Log error but don't fail the cancel operation
        console.error("[CANCEL] error printing empty label:", clearError);
      }
    }

    return NextResponse.json({
      ok,
      statusCode: result.statusCode.toString(),
    });
  } catch (e: any) {
    console.error("[CANCEL] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
