import { NextResponse } from "next/server";
import { assertCentralEnabled, audit, validAccountId } from "@/lib/central";
import { jsonError } from "@/lib/http";
import { isSmsAccepted, providerPost, upstreamMessage } from "@/lib/provider";
import { accessRoute } from "@/lib/provider-bundle";

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  let accountId = "";
  try {
    assertCentralEnabled(); accountId = validAccountId((await context.params).accountId);
    const { mobile } = await request.json() as { mobile?: string };
    if (!mobile || !/^1\d{10}$/.test(mobile)) return NextResponse.json({ ok: false, message: "手机号格式错误" }, { status: 400 });
    const payload = await providerPost("gateway", accessRoute("sms"), { mobile }, { signing: "legacy-header" });
    const ok = isSmsAccepted(payload); await audit(accountId, "account.sms", null, ok, upstreamMessage(payload, ok ? "验证码已发送" : "验证码发送失败"));
    return NextResponse.json({ ok, message: upstreamMessage(payload, ok ? "验证码已发送" : "验证码发送失败") }, { status: ok ? 200 : 429 });
  } catch (error) { await audit(accountId || null, "account.sms", null, false, error instanceof Error ? error.message : "失败").catch(() => undefined); return jsonError(error); }
}
