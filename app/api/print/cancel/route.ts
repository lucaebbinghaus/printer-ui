// app/api/printer/cancel/route.ts
import { NextResponse } from "next/server";
import { getConfig } from "@/app/lib/storage";
import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
} from "node-opcua";
import { logInfo, logError, logApiError } from "@/app/lib/logger";

export const runtime = "nodejs";

// HIER bitte die NodeId des "Interpreter"-Objektes eintragen.
// In UAExpert: Rechtsklick auf "Interpreter" → Attributes → NodeId kopieren.
const INTERPRETER_OBJECT_NODEID = "ns=3;i=10005"; // TODO: anpassen
const TOTAL_CANCEL_METHOD_NODEID = "ns=3;i=6007";

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
    logInfo(`Connecting to OPC UA endpoint: ${endpointUrl}`, "CANCEL");

    const client = OPCUAClient.create({
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
      endpointMustExist: false,
    });

    await client.connect(endpointUrl);
    const session = await client.createSession();

    logInfo("Calling TotalCancel method", "CANCEL", {
      objectId: INTERPRETER_OBJECT_NODEID,
      methodId: TOTAL_CANCEL_METHOD_NODEID,
    });

    const result = await session.call({
      objectId: INTERPRETER_OBJECT_NODEID,
      methodId: TOTAL_CANCEL_METHOD_NODEID,
      inputArguments: [],
    });

    logInfo(`TotalCancel result: ${result.statusCode.toString()}`, "CANCEL", {
      statusCode: result.statusCode.toString(),
      statusName: result.statusCode.name,
    });

    const ok = result.statusCode.name === "Good";

    await session.close();
    await client.disconnect();

    return NextResponse.json({
      ok,
      statusCode: result.statusCode.toString(),
    });
  } catch (e: any) {
    logApiError("/api/print/cancel", "POST", e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
