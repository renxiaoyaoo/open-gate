import { NextResponse } from "next/server";
import { assertCentralEnabled } from "@/lib/central";
import { refreshPublicDoors } from "@/lib/access-service";
import { jsonError } from "@/lib/http";

export async function GET() {
  try {
    assertCentralEnabled();
    const result = await refreshPublicDoors();
    return NextResponse.json({ ok: true, data: result.doors, meta: { accountCount: result.accountCount, failedAccountCount: result.failedAccountCount, expiredAccountCount: result.expiredAccountCount } });
  } catch (error) { return jsonError(error); }
}
