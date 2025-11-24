import { NextResponse } from "next/server";
import { connectOPCUA, callMethod } from "@/lib/opcua/client";
import { METHODS } from "@/lib/opcua/config";

export const runtime = "nodejs";

export async function POST() {
  const { client, session } = await connectOPCUA();
  try {
    await callMethod(
      session,
      METHODS.labelServiceObject,
      METHODS.abort,
      []
    );

    return NextResponse.json({ ok: true, message: "Job aborted" });
  } catch (e: any) {
    return new NextResponse(e?.message || "Abort error", { status: 500 });
  } finally {
    await session.close();
    await client.disconnect();
  }
}
