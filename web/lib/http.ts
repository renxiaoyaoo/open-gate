import { NextResponse } from "next/server";
import { UpstreamError, upstreamMessage } from "./provider";
export function jsonError(error: unknown) {
  if (error instanceof UpstreamError && error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)) {
    const payload = error.payload as Record<string, unknown>;
    return NextResponse.json({
      ok: false,
      message: upstreamMessage(payload, error.message),
      diagnostic: { code: payload.code ?? null, fields: Object.keys(payload).sort() },
    }, { status: 502 });
  }
  const message = error instanceof Error ? error.message : "请求失败";
  return NextResponse.json({ ok: false, message }, { status: 502 });
}
