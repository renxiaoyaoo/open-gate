import { NextResponse } from "next/server";
import { assertCentralEnabled } from "@/lib/central";
import { openPublicDoor } from "@/lib/access-service";
import { jsonError } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ doorKey: string }> }) {
  try {
    assertCentralEnabled();
    const result = await openPublicDoor((await context.params).doorKey, request.headers.get("idempotency-key") || "");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) { return jsonError(error); }
}
