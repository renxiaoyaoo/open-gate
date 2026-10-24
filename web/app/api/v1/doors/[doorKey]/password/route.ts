import { NextResponse } from "next/server";
import { assertCentralEnabled } from "@/lib/central";
import { publicDoorPassword } from "@/lib/access-service";
import { jsonError } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ doorKey: string }> }) {
  try { assertCentralEnabled(); return NextResponse.json({ ok: true, data: await publicDoorPassword((await context.params).doorKey) }); }
  catch (error) { return jsonError(error); }
}
