// app/api/buttons/route.ts
import { NextResponse } from "next/server";
import buttons from "@/data/products.json"; 

export async function GET() {
  return NextResponse.json(buttons.items);
}
