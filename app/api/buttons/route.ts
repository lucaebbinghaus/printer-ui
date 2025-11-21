// app/api/buttons/route.ts
import { NextResponse } from "next/server";
import buttons from "@/data/buttons.json"; 

export async function GET() {
  return NextResponse.json(buttons);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const html = body?.html;

    if (!html || typeof html !== "string") {
      return new NextResponse("html missing or not a string", { status: 400 });
    }

    const printerRes = await fetch(
      "http://192.168.0.27:80/Integration/print/Execute",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // EXAKT nur html senden – wie im Curl
        body: JSON.stringify({ html }),
      }
    );

    const text = await printerRes.text();

    if (!printerRes.ok) {
      console.error("Printer error:", printerRes.status, text);
      return new NextResponse(text || "Printer error", { status: 502 });
    }

    return NextResponse.json({ ok: true, printerResponse: text });
  } catch (e: any) {
    console.error(e);
    return new NextResponse(e?.message ?? "Unknown error", { status: 500 });
  }
}