import { NextResponse } from "next/server";
import { assertCentralEnabled, audit, removeAccount, validAccountId } from "@/lib/central";
import { jsonError } from "@/lib/http";

export async function DELETE(_request: Request, context: { params: Promise<{ accountId: string }> }) {
  let accountId = "";
  try {
    assertCentralEnabled();
    accountId = validAccountId((await context.params).accountId);
    await removeAccount(accountId);
    await audit(null, "account.logout", accountId, true, "中心会话及门禁缓存已删除");
    return NextResponse.json({ ok: true, message: "账号已退出" });
  } catch (error) {
    await audit(null, "account.logout", accountId || null, false, error instanceof Error ? error.message : "失败").catch(() => undefined);
    return jsonError(error);
  }
}
