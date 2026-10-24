import { audit, loadCentralSession, persistCentralSession, saveCentralSession, saveDoors, type CentralSession } from "./central";
import { communityCodes, communityIds, dedupeDoors, deviceId, encryptMobile, isSuccess, loginCredential, normalizeDoors, providerPost, upstreamMessage } from "./provider";
import { personalDisplayName } from "./account-name";

export async function centralLogin(accountId: string, mobile: string, smsCode: string) {
  const openId = deviceId(); const context = { cookies: {} };
  const login = await providerPost("mobile", "app/v1/login", { mobile: encryptMobile(mobile), smsCode, appChannel: 1 }, { openId, signing: "mobile-body", encoding: "json", context });
  const credential = loginCredential(login.data);
  if (!isSuccess(login) || !credential) throw new Error(upstreamMessage(login, "登录失败"));
  const personal = await providerPost("mobile", "app/v1/personal/info", { method: "personalInfo" }, { sessionId: credential, signingToken: credential, openId, signing: "mobile-body", encoding: "json", context });
  if (!isSuccess(personal)) throw new Error(upstreamMessage(personal, "登录初始化失败"));
  const session: CentralSession = { sessionId: credential, signingToken: credential, openId, context };
  const resolvedAccountId = await saveCentralSession(accountId, mobile, personalDisplayName(personal.data), session);
  await audit(resolvedAccountId, "account.login", null, true, "中心会话已更新");
}

export async function centralDoors(accountId: string) {
  const session = await loadCentralSession(accountId);
  const options = { sessionId: session.sessionId, signingToken: session.signingToken, openId: session.openId, signing: "mobile-body" as const, context: session.context };
  const communities = await providerPost("mobile", "app/user/v2/communityInfo", { method: "communityInfo" }, { ...options, encoding: "json" });
  if (!isSuccess(communities)) throw new Error(upstreamMessage(communities, "小区查询失败"));
  const codes = communityCodes(communities.data); const doors = [];
  for (const communityId of communityIds(communities.data).slice(0, 20)) {
    const payload = await providerPost("mobile", "app/user/v2/queryUserDoorByCacheNew", { communityId }, { ...options, encoding: "multipart" });
    if (isSuccess(payload)) doors.push(...normalizeDoors(payload.data, communityId, codes.get(communityId)));
  }
  const result = dedupeDoors(doors); await persistCentralSession(accountId, session); await saveDoors(accountId, result); return result;
}
