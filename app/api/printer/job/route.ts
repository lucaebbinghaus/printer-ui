import { NextResponse } from "next/server";
import { connectOPCUA, readNode } from "@/lib/opcua/client";
import { NODES } from "@/lib/opcua/config";

export const runtime = "nodejs";

export async function GET() {
  const { client, session } = await connectOPCUA();
  try {
    const state = await readNode(session, NODES.jobState);
    const printed = await readNode(session, NODES.jobPrinted);
    const remaining = await readNode(session, NODES.jobRemaining);
    const total = await readNode(session, NODES.jobTotal);

    return NextResponse.json({
      ok: true,
      state,
      printed,
      remaining,
      total,
    });
  } catch (e: any) {
    return new NextResponse(e?.message || "Job error", { status: 500 });
  } finally {
    await session.close();
    await client.disconnect();
  }
}
