// app/api/printer/cancel/route.ts
import { NextResponse } from "next/server";
import { getConfig } from "@/app/lib/storage";
import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  Variant,
  DataType,
} from "node-opcua";

export const runtime = "nodejs";

// HIER bitte die NodeId des "Interpreter"-Objektes eintragen.
// In UAExpert: Rechtsklick auf "Interpreter" → Attributes → NodeId kopieren.
const INTERPRETER_OBJECT_NODEID = "ns=3;i=10005"; // TODO: anpassen
const TOTAL_CANCEL_METHOD_NODEID = "ns=3;i=6007";
// HIER bitte die NodeId der "TriggerInput"-Methode unter Interpreter eintragen.
// In UAExpert: Rechtsklick auf "TriggerInput" unter Interpreter → Attributes → NodeId kopieren.
const TRIGGER_INPUT_METHOD_NODEID = "ns=3;i=6005"; // TODO: anpassen

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

    // After canceling, trigger a label feed to clear the print unit
    if (ok) {
      try {
        console.log("[CANCEL] calling TriggerInput with LBLFEED to clear print unit...");

        // Call TriggerInput method with LBLFEED argument via Interpreter object
        // The input argument should be a string "LBLFEED" wrapped in a Variant
        const feedResult = await session.call({
          objectId: INTERPRETER_OBJECT_NODEID,
          methodId: TRIGGER_INPUT_METHOD_NODEID,
          inputArguments: [
            new Variant({
              dataType: DataType.String,
              value: "LBLFEED",
            }),
          ],
        });

        console.log("[CANCEL] TriggerInput call result:", feedResult.statusCode.toString());

        if (feedResult.statusCode.name !== "Good") {
          console.warn(
            "[CANCEL] TriggerInput failed, but cancel was successful:",
            feedResult.statusCode.toString()
          );
        } else {
          console.log("[CANCEL] empty label feed triggered successfully");
        }
      } catch (clearError: any) {
        // Log error but don't fail the cancel operation
        console.error("[CANCEL] error triggering label feed:", clearError);
      }
    }

    await session.close();
    await client.disconnect();

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
