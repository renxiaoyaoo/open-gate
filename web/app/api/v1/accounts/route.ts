import { NextResponse } from "next/server";
import { assertCentralEnabled, publicAccounts } from "@/lib/central";
import { jsonError } from "@/lib/http";

export async function GET() {
  try { assertCentralEnabled(); return NextResponse.json({ ok: true, data: await publicAccounts() }); }
  catch (error) { return jsonError(error); }
}
