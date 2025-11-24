import { NextResponse } from "next/server";
import { connectOPCUA, callMethod, V } from "@/lib/opcua/client";
import { METHODS } from "@/lib/opcua/config";

export const runtime = "nodejs";

/**
 * Body:
 * {
 *   template: "Layout_60x30", 
 *   fields: { ART_NUMBER:"803033", NAME:"Salamibrötchen", ... },
 *   qty: 10
 * }
 */
export async function POST(req: Request) {
  const { client, session } = await connectOPCUA();
  try {
    const body = await req.json();
    const { template, fields = {}, qty = 1 } = body;

    if (!template) {
      return new NextResponse("Missing template", { status: 400 });
    }

    const obj = METHODS.labelServiceObject;

    // 1) Label/Template laden
    await callMethod(session, obj, METHODS.loadLabel, [V.str(template)]);

    // 2) Felder setzen (Replaceable Fields im Template)
    for (const [key, value] of Object.entries(fields)) {
      await callMethod(session, obj, METHODS.setFieldValue, [
        V.str(key),
        V.str(String(value)),
      ]);
    }

    // 3) Drucken
    await callMethod(session, obj, METHODS.print, [V.u32(qty)]);

    return NextResponse.json({ ok: true, message: "Print started" });
  } catch (e: any) {
    return new NextResponse(e?.message || "Print error", { status: 500 });
  } finally {
    await session.close();
    await client.disconnect();
  }
}
