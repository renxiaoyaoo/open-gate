import { audit, getDoorByPublicId, loadCentralSession, persistCentralSession, saveCentralSession, saveDoors, updateDoorSelection, type CentralSession } from "./central";
import { ALL_DOORS_PATH, HOME_DOORS_PATH, communityCodes, communityIds, dedupeDoors, deviceId, doorSortBody, doorSortMoveBody, encryptMobile, isSuccess, loginCredential, normalizeDoors, providerPost, upstreamMessage } from "./provider";
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
    let home: Awaited<ReturnType<typeof providerPost>> | null = null;
    try {
      home = await providerPost("mobile", HOME_DOORS_PATH, { communityId }, { ...options, encoding: "multipart" });
    } catch {
      // The complete list remains usable when the home-list request is unavailable.
    }
    const featured = home && isSuccess(home) ? normalizeDoors(home.data, communityId, codes.get(communityId)) : [];
    const featuredIds = new Set(featured.map((door) => `${door.communityId}:${door.doorControlId}`));
    let all: Awaited<ReturnType<typeof providerPost>> | null = null;
    try {
      all = await providerPost("mobile", ALL_DOORS_PATH, { communityId }, { ...options, encoding: "multipart" });
    } catch {
      // Fall through to the already verified home-list endpoint below.
    }
    if (all && isSuccess(all)) {
      doors.push(...normalizeDoors(all.data, communityId, codes.get(communityId)).map((door) => ({
        ...door,
        providerFeatured: featuredIds.has(`${door.communityId}:${door.doorControlId}`),
      })));
      continue;
    }

    // Older provider deployments may not expose the complete-list endpoint.
    // Preserve the previously verified home-list behavior instead of erasing
    // the account's cached doors when that happens.
    if (!home || !isSuccess(home)) throw new Error(upstreamMessage(home || {}, "门禁查询失败"));
    doors.push(...featured.map((door) => ({ ...door, providerFeatured: true })));
  }
  const result = dedupeDoors(doors); await persistCentralSession(accountId, session); await saveDoors(accountId, result); return result;
}

export async function setProviderDoorSelected(publicId: string, selected: boolean) {
  const door = await getDoorByPublicId(publicId);
  if (!door) throw new Error("门禁不存在，请先刷新门禁列表");
  const session = await loadCentralSession(door.accountId);
  const options = { sessionId: session.sessionId, signingToken: session.signingToken, openId: session.openId, signing: "mobile-body" as const, context: session.context };
  const all = await providerPost("mobile", ALL_DOORS_PATH, { communityId: door.communityId }, { ...options, encoding: "multipart" });
  if (!isSuccess(all)) throw new Error(upstreamMessage(all, "门禁查询失败"));
  const body = doorSortBody(all.data, door.communityId, door.doorControlId, selected);
  const saved = await providerPost("mobile", "app/user/v1/doorSort", body, { ...options, encoding: "json", signingExclude: ["list"] });
  if (!isSuccess(saved)) throw new Error(upstreamMessage(saved, "常用门禁保存失败"));
  await persistCentralSession(door.accountId, session);
  await updateDoorSelection(publicId, selected);
  await audit(door.accountId, "door.selection", publicId, true, selected ? "已加入官方常用门禁" : "已移出官方常用门禁");
}

export async function moveProviderDoor(publicId: string, direction: "up" | "down") {
  const door = await getDoorByPublicId(publicId);
  if (!door) throw new Error("门禁不存在，请先刷新门禁列表");
  const session = await loadCentralSession(door.accountId);
  const options = { sessionId: session.sessionId, signingToken: session.signingToken, openId: session.openId, signing: "mobile-body" as const, context: session.context };
  const all = await providerPost("mobile", ALL_DOORS_PATH, { communityId: door.communityId }, { ...options, encoding: "multipart" });
  if (!isSuccess(all)) throw new Error(upstreamMessage(all, "门禁查询失败"));
  const body = doorSortMoveBody(all.data, door.communityId, door.doorControlId, direction);
  const saved = await providerPost("mobile", "app/user/v1/doorSort", body, { ...options, encoding: "json", signingExclude: ["list"] });
  if (!isSuccess(saved)) throw new Error(upstreamMessage(saved, "门禁顺序保存失败"));
  await persistCentralSession(door.accountId, session);
  await audit(door.accountId, "door.order", publicId, true, direction === "up" ? "已向前移动" : "已向后移动");
}
