import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { html, name, weight, art_number, mhd } = await req.json();

    if (!html) {
      return new NextResponse("Missing html", { status: 400 });
    }

    // DEBUG
    console.log("PRINT DATA:", { html, name, weight, art_number, mhd });

    const printerBody = {
      html,
      name,
      weight,
      art_number,
      mhd,
    };

    const printerRes = await fetch(
      "http://host.docker.internal:80/Integration/print/Execute",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(printerBody),
      }
    );

    const text = await printerRes.text();

    if (!printerRes.ok) {
      return new NextResponse(text, { status: 502 });
    }

    return NextResponse.json({ ok: true, printerResponse: text });
  } catch (e: any) {
    return new NextResponse(e.message ?? "Unknown error", { status: 500 });
  }
}
