import { NextResponse } from "next/server";
import { connectOPCUA, readNode } from "@/lib/opcua/client";
import { NODES } from "@/lib/opcua/config";

export const runtime = "nodejs";

export async function GET() {
  const { client, session } = await connectOPCUA();
  try {
    const deviceStatus = await readNode(session, NODES.deviceStatus);
    const mediaStatus = await readNode(session, NODES.mediaStatus);
    const headStatus = await readNode(session, NODES.headStatus);
    const ribbonStatus = await readNode(session, NODES.ribbonStatus);

    return NextResponse.json({
      ok: true,
      deviceStatus,
      mediaStatus,
      headStatus,
      ribbonStatus,
    });
  } catch (e: any) {
    return new NextResponse(e?.message || "Status error", { status: 500 });
  } finally {
    await session.close();
    await client.disconnect();
  }
}
