// app/api/presets/[presetId]/route.ts
import { NextResponse } from "next/server";
import { getProducts } from "@/app/lib/storage";

export const runtime = "nodejs";

type Params = {
  params: {
    presetId: string;
  };
};

export async function GET(_req: Request, { params }: Params) {
  try {
    const { presetId } = params;

    const file = await getProducts<any>();
    const items: any[] = file.items || [];

    const preset = items.find((p) => String(p.id) === String(presetId));

    if (!preset) {
      return new NextResponse("Preset not found", { status: 404 });
    }

    return NextResponse.json(preset, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/presets/[presetId] failed:", e);
    return new NextResponse(`GET failed: ${e?.message}`, { status: 500 });
  }
}
