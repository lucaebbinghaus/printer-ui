// app/api/logs/client/route.ts
import { NextResponse } from "next/server";
import { logInfo, logWarn, logError, logDebug } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { level, message, context, error, data } = body as {
      level: "info" | "warn" | "error" | "debug";
      message: string;
      context?: string;
      error?: {
        name: string;
        message: string;
        stack?: string;
        code?: string;
      };
      data?: any;
    };

    // Forward to server-side logger
    switch (level) {
      case "info":
        logInfo(message, context, data);
        break;
      case "warn":
        logWarn(message, context, data);
        break;
      case "error":
        // Convert error object to Error instance if provided
        const errorObj = error
          ? Object.assign(new Error(error.message), {
              name: error.name,
              stack: error.stack,
              code: error.code,
            })
          : undefined;
        logError(message, errorObj, context, data);
        break;
      case "debug":
        logDebug(message, context, data);
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Don't log errors about logging - that would cause infinite loops
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to log" },
      { status: 400 }
    );
  }
}

