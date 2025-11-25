// app/api/presets/route.ts
import { NextResponse } from "next/server";
import { getProducts } from "@/app/lib/storage";

export const runtime = "nodejs";

type PresetSummary = {
  id: string;
  name: string;
};

export async function GET() {
  try {
    // Lies products.json über storage.ts
    const file = await getProducts<any>();
    const items: any[] = file.items || [];

    // auf eine schlanke Liste mappen
    const presets: PresetSummary[] = items
      .filter((p) => p && p.id) // nur Items mit id
      .map((p) => ({
        id: String(p.id),
        name:
          p.name ??
          p.title ??
          p.label ??
          `Preset ${p.id}`, // Fallback, falls kein Name-Feld existiert
      }));

    return NextResponse.json(presets, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/presets failed:", e);
    return new NextResponse(`GET failed: ${e?.message}`, { status: 500 });
  }
}
