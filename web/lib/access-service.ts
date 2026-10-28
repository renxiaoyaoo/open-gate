import { audit, completedIdempotentOpen, getDoorByPublicId, listActiveAccountIds, listPublicDoors, loadCentralSession, persistCentralSession } from "./central";
import { centralDoors } from "./provider-service";
import { doorPassword, isAuthenticationExpired, isSuccess, openDoorBody, providerPost, upstreamMessage } from "./provider";
import { accessRoute } from "./provider-bundle.ts";

/** Refresh every provider account while keeping account identity inside the service boundary. */
export async function refreshPublicDoors() {
  const accountIds = await listActiveAccountIds();
  const results = await Promise.allSettled(accountIds.map((accountId) => centralDoors(accountId)));
  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  const expired = rejected.filter((result) => isAuthenticationExpired(result.reason));
  return { doors: await listPublicDoors(), accountCount: accountIds.length, failedAccountCount: rejected.length, expiredAccountCount: expired.length };
}

export async function openPublicDoor(publicId: string, idempotencyKey: string) {
  const door = await getDoorByPublicId(publicId);
  if (!door) throw new Error("门禁不存在，请先刷新门禁列表");
  if (idempotencyKey) {
    const previous = await completedIdempotentOpen(door.accountId, idempotencyKey);
    if (previous) return { ok: true, message: previous.message || "开门请求已处理", replayed: true };
  }
  const target = `${door.communityId}:${door.doorControlId}`;
  try {
    const session = await loadCentralSession(door.accountId);
    const payload = await providerPost("mobile", accessRoute("operate"), openDoorBody(door.doorControlId, door.communityId), { sessionId: session.sessionId, signingToken: session.signingToken, openId: session.openId, signing: "mobile-body", encoding: "query", context: session.context });
    await persistCentralSession(door.accountId, session);
    const ok = isSuccess(payload); const message = upstreamMessage(payload, ok ? "开门请求成功" : "开门失败");
    await audit(door.accountId, "door.open", target, ok, message, idempotencyKey || undefined);
    return { ok, message, data: payload.data };
  } catch (error) {
    await audit(door.accountId, "door.open", target, false, error instanceof Error ? error.message : "失败").catch(() => undefined);
    throw error;
  }
}

export async function publicDoorPassword(publicId: string) {
  const door = await getDoorByPublicId(publicId);
  if (!door) throw new Error("门禁不存在，请先刷新门禁列表");
  if (!door.passwordSupported) throw new Error("该设备不支持密码开门");
  const data = doorPassword(door.mac || "", door.communityCode || "");
  await audit(door.accountId, "door.password", `${door.communityId}:${door.doorControlId}`, true, "密码已生成");
  return data;
}
