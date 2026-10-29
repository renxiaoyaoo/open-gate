import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { lockRoute, providerBundle } from "./provider-bundle.ts";

export type OpenLockSession = { token: string; displayName?: string; mediaToken?: string; mediaExpiresAt?: number };
type ProviderResponse = { status?: number | string; success?: boolean; msg?: string; data?: unknown };

function at(value: unknown, path: string): unknown {
  return path.split(".").filter(Boolean).reduce<unknown>((current, key) => {
    if (typeof current === "string") {
      try { current = JSON.parse(current) as unknown; } catch { return undefined; }
    }
    return current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
  }, value);
}
function eventTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
  if (typeof value !== "string" || !value.trim()) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 10_000_000_000 ? Math.floor(numeric / 1000) : numeric;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}
function mediaCursor(value: string) {
  if (!value) return { context: "", anchor: Math.floor(Date.now() / 1000) };
  try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { context?: unknown; anchor?: unknown }; const anchor = Number(parsed.anchor); if (typeof parsed.context === "string" && Number.isFinite(anchor) && anchor > 0) return { context: parsed.context, anchor }; } catch { /* reject malformed public cursors below */ }
  throw new Error("OpenLock media cursor is invalid");
}
function expand(value: unknown, values: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => expand(item, values));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expand(item, values)]));
  if (typeof value === "string" && /^\{[^}]+\}$/.test(value)) return values[value.slice(1, -1)] ?? value;
  return value;
}

export class OpenLockProvider {
  private readonly config = providerBundle().lock;
  private readonly session?: OpenLockSession;
  constructor(session?: OpenLockSession) {
    this.session = session;
    if (!this.config) throw new Error("OpenLock provider is not configured");
  }

  sessionState() { return this.session; }

  private async refreshMediaSession() {
    const auth = this.config!.media.auth;
    if (!auth) throw new Error("OpenLock media authentication is not configured");
    const request: Record<string, string | number> = { AccessToken: "", Action: auth.action, AppKey: auth.appKey, Nonce: randomInt(1, 2_147_483_647), OpenID: auth.openId, RequestId: randomUUID(), Timestamp: Math.floor(Date.now() / 1000) };
    const source = Object.entries(request)
      .filter(([key, value]) => !auth.signatureExclude.includes(key) && value !== "")
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, value]) => `${key.replaceAll("_", ".")}=${value}`)
      .join("&");
    request.Signature = createHmac("sha1", auth.appSecret).update(source).digest("base64");
    const response = await fetch(new URL(auth.route, this.config!.media.baseUrl), { method: "POST", headers: { "content-type": "application/json;charset=utf-8" }, body: JSON.stringify(request), signal: AbortSignal.timeout(12_000) });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const token = at(payload, auth.tokenPath); const expiry = Number(at(payload, auth.expiryPath));
    if (!response.ok || typeof token !== "string" || !token || !Number.isFinite(expiry)) throw new Error("OpenLock media authentication failed");
    if (!this.session) throw new Error("OpenLock session is unavailable");
    this.session.mediaToken = token; this.session.mediaExpiresAt = expiry;
    return token;
  }

  private async mediaToken() {
    if (this.session?.mediaToken && (this.session.mediaExpiresAt || 0) > Math.floor(Date.now() / 1000) + 60) return this.session.mediaToken;
    return this.refreshMediaSession();
  }

  private headers(token = this.session?.token || "") {
    return { ...this.config!.client, token, requestId: randomUUID() };
  }

  private async request(route: Parameters<typeof lockRoute>[0], options: { method?: string; query?: Record<string, string>; form?: Record<string, string>; json?: Record<string, unknown>; token?: string } = {}) {
    const url = new URL(lockRoute(route), this.config!.baseUrl);
    for (const [key, value] of Object.entries(options.query || {})) url.searchParams.set(key, value);
    const body = options.form ? new URLSearchParams(options.form) : options.json ? JSON.stringify(options.json) : undefined;
    const response = await fetch(url, { method: options.method || "GET", headers: { ...this.headers(options.token), ...(options.form ? { "content-type": "application/x-www-form-urlencoded" } : options.json ? { "content-type": "application/json;charset=utf-8" } : {}) }, body, signal: AbortSignal.timeout(12_000) });
    const payload = await response.json().catch(() => ({})) as ProviderResponse;
    if (!response.ok || payload.success !== true || String(payload.status) !== "1") throw new Error(`OpenLock provider: ${payload.status ?? response.status} ${payload.msg || "request failed"}`);
    return payload.data;
  }

  async passwordLogin(phone: string, password: string) {
    if (!/^1\d{10}$/.test(phone)) throw new Error("请输入正确的手机号");
    if (!password) throw new Error("请输入密码");
    const identity = this.config!.identityCipher;
    const tokenData = await this.request("loginToken", { query: { encryptUserPhone: identity }, token: "" });
    const loginToken = Array.isArray(tokenData) ? tokenData[0] : tokenData;
    if (typeof loginToken !== "string" || !loginToken) throw new Error("OpenLock 登录令牌无效");
    const data = await this.request("login", { method: "POST", token: "", form: { loginToken, encryptUserPhone: identity, regionCode: "86", passWord2: createHash("md5").update(password).digest("hex"), areaAbbreviation: "CN" } });
    const profile = Array.isArray(data) ? data[0] as Record<string, unknown> : undefined;
    const token = profile?.token;
    if (typeof token !== "string" || !token) throw new Error("OpenLock 登录响应无会话");
    const displayName = at(profile, this.config!.fields.profileName);
    const session: OpenLockSession = { token, displayName: typeof displayName === "string" ? displayName : "OpenLock 账号" };
    const provider = new OpenLockProvider(session);
    if (this.config!.media.auth) await provider.refreshMediaSession().catch(() => undefined);
    return session;
  }

  async devices() {
    const raw = await this.request("devices", { query: { pageNumber: "1", pageSize: "100" } });
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item) => ({ id: String(at(item, this.config!.fields.deviceId) ?? ""), name: String(at(item, this.config!.fields.deviceName) ?? "智能锁") })).filter((item) => item.id);
  }

  async detail(lockId: string) {
    const raw = await this.request("detail", { query: { lockId } });
    const root = Array.isArray(raw) ? raw[0] : raw;
    const detail = at(root, this.config!.fields.detail);
    const read = (field: keyof NonNullable<typeof this.config>["fields"]) => { const path = this.config!.fields[field]; return path ? at(detail, path) : undefined; };
    return { name: read("deviceName"), wifiName: read("wifiName"), wifiSignal: read("wifiSignal"), battery: read("battery"), cameraBattery: read("cameraBattery"), batteryUpdatedAt: read("batteryUpdatedAt") };
  }

  async captures(lockId: string, cursor = "") {
    const detailData = await this.request("detail", { query: { lockId } });
    const root = Array.isArray(detailData) ? detailData[0] : detailData;
    const detail = at(root, this.config!.fields.detail);
    const { context, anchor: now } = mediaCursor(cursor);
    const accessToken = await this.mediaToken();
    const values: Record<string, unknown> = {
      productId: at(detail, this.config!.fields.mediaProductId), deviceName: at(detail, this.config!.fields.mediaDeviceName),
      deviceId: lockId, startTime: now - 7 * 24 * 60 * 60, endTime: now, requestId: randomUUID(), thumbnails: [], accessToken, context,
    };
    const candidates: Array<{ event: unknown; thumbnail: string; video?: string }> = [];
    const mediaResponse = await fetch(new URL(this.config!.media.route, this.config!.media.baseUrl), { method: "POST", headers: { "content-type": "application/json;charset=utf-8" }, body: JSON.stringify(expand(this.config!.media.eventRequest, values)), signal: AbortSignal.timeout(15_000) });
    const mediaPayload = await mediaResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!mediaResponse.ok || String(at(mediaPayload, this.config!.media.successPath)) !== this.config!.media.successValue) throw new Error("OpenLock media event request failed");
    const eventsValue = at(mediaPayload, this.config!.fields.mediaEvents); const events = Array.isArray(eventsValue) ? eventsValue : [];
    const sharedVideoValue = at(mediaPayload, this.config!.fields.mediaVideo || "data.VideoURL");
    const sharedVideo = events.length === 1 && typeof sharedVideoValue === "string" && sharedVideoValue.startsWith("https://") ? sharedVideoValue : undefined;
    for (const event of events) {
      const thumbnail = at(event, this.config!.fields.mediaThumbnail);
      if (typeof thumbnail !== "string" || !thumbnail) continue;
      const eventVideoValue = at(event, "VideoURL") ?? (this.config!.fields.mediaVideo ? at(event, this.config!.fields.mediaVideo) : undefined);
      const video = typeof eventVideoValue === "string" && eventVideoValue.startsWith("https://") ? eventVideoValue : sharedVideo;
      candidates.push({ event, thumbnail, video });
    }
    const listOver = at(mediaPayload, this.config!.fields.mediaListOver || "data.Listover") === true;
    const contextValue = at(mediaPayload, this.config!.fields.mediaContext || "data.Context");
    const nextCursor = !listOver && typeof contextValue === "string" && contextValue && contextValue !== context ? Buffer.from(JSON.stringify({ context: contextValue, anchor: now })).toString("base64url") : undefined;
    if (!candidates.length) return { items: [], nextCursor };
    const signed: unknown[] = [];
    for (let offset = 0; offset < candidates.length; offset += 40) {
      const thumbnails = candidates.slice(offset, offset + 40).map((item) => item.thumbnail);
      const signedData = await this.request("thumbnail", { method: "POST", json: expand(this.config!.media.thumbnailRequest, { ...values, thumbnails }) as Record<string, unknown> });
      const signedRoot = Array.isArray(signedData) ? signedData[0] : signedData;
      const signedValue = at(signedRoot, this.config!.fields.signedThumbnails);
      if (Array.isArray(signedValue)) signed.push(...signedValue);
    }
    const items = candidates.map(({ event, video }, index) => {
      const eventCode = String(at(event, this.config!.fields.mediaEventType || "EventType") ?? at(event, this.config!.fields.mediaEventId) ?? "");
      const time = eventTime(at(event, this.config!.fields.mediaEventTime) ?? at(event, "EventTime") ?? at(event, "CreateTime"));
      return { id: `${eventCode || "event"}-${time}-${index}`, time, type: eventCode, image: String(at(signed[index], this.config!.fields.signedThumbnailUrl) ?? ""), video };
    }).filter((item) => item.image.startsWith("https://"));
    return { items, nextCursor };
  }

  private normalizeLogs(raw: unknown) {
    const groups = Array.isArray(raw) ? raw : [];
    return groups.flatMap((group) => { const items = at(group, this.config!.fields.logItems); const date = String(at(group, this.config!.fields.logDate || "logDate") ?? ""); return Array.isArray(items) ? items.map((item) => {
      const time = String(at(item, this.config!.fields.logTime) ?? "");
      const picture = this.config!.fields.logPicture ? at(item, this.config!.fields.logPicture) : undefined;
      const pictureId = typeof picture === "string" && /^\d+$/.test(picture) ? picture : undefined;
      return { time: date && !time.includes(date) ? `${date} ${time}`.trim() : time, content: String(at(item, this.config!.fields.logContent) ?? ""), pictureId };
    }) : []; });
  }
  private async logPage(load: () => Promise<unknown>, page: number) {
    const items = this.normalizeLogs(await load()).filter((item, index, list) => list.findIndex((candidate) => candidate.time === item.time && candidate.content === item.content) === index);
    return { items, nextCursor: items.length >= 20 ? String(page + 1) : undefined };
  }
  private async signedLogPictures(lockId: string, logs: Array<{ time: string; content: string; pictureId?: string }>) {
    const candidates = logs.filter((item): item is typeof item & { pictureId: string } => Boolean(item.pictureId));
    if (!candidates.length) return logs.map((item) => ({ time: item.time, content: item.content }));
    const detailData = await this.request("detail", { query: { lockId } });
    const root = Array.isArray(detailData) ? detailData[0] : detailData;
    const detail = at(root, this.config!.fields.detail);
    const accessToken = await this.mediaToken();
    const values = { accessToken, productId: at(detail, this.config!.fields.mediaProductId), deviceName: at(detail, this.config!.fields.mediaDeviceName), deviceId: lockId };
    const signedUrls = new Map<string, string>();
    for (let offset = 0; offset < candidates.length; offset += 40) {
      const chunk = candidates.slice(offset, offset + 40);
      const thumbnails = chunk.map((item) => this.config!.media.alarmThumbnailTemplate.replace("{pictureId}", item.pictureId));
      const signedData = await this.request("thumbnail", { method: "POST", json: expand(this.config!.media.thumbnailRequest, { ...values, thumbnails }) as Record<string, unknown> });
      const signedRoot = Array.isArray(signedData) ? signedData[0] : signedData;
      const signedValue = at(signedRoot, this.config!.fields.signedThumbnails); const signed = Array.isArray(signedValue) ? signedValue : [];
      chunk.forEach((item, index) => { const url = at(signed[index], this.config!.fields.signedThumbnailUrl); if (typeof url === "string" && url.startsWith("https://")) signedUrls.set(item.pictureId, url); });
    }
    return logs.map(({ pictureId, ...item }) => ({ ...item, image: pictureId ? signedUrls.get(pictureId) : undefined }));
  }
  async lockDynamics(lockId: string, page = 1) { const result = await this.logPage(() => this.request("securityLogs", { query: { lockId, pageNumber: String(page), pageSize: "20", type: "1" } }), page); return { ...result, items: await this.signedLogPictures(lockId, result.items) }; }
  async securityLogs(lockId: string, page = 1) { const result = await this.logPage(() => this.request("securityLogs", { query: { lockId, pageNumber: String(page), pageSize: "20", type: "2" } }), page); return { ...result, items: await this.signedLogPictures(lockId, result.items) }; }
  operationLogs(lockId: string, page = 1) { return this.logPage(() => this.request("operationLogs", { method: "POST", json: { lockId, pageNumber: String(page), pageSize: "20" } }), page); }
  async temporaryPasswordCount(lockId: string) { const raw = await this.request("temporaryPasswordCount", { query: { lockId } }); const root = Array.isArray(raw) ? raw[0] : raw; return { remaining: Number(at(root, this.config!.fields.temporaryPasswordCount) ?? 0) }; }
  async createTemporaryPassword(lockId: string) {
    const url = new URL(lockRoute("temporaryPasswordCreate"), this.config!.baseUrl);
    url.searchParams.set("lockId", lockId); url.searchParams.set("passwordEncrypt", "false");
    const response = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(12_000) });
    const payload = await response.json().catch(() => ({})) as { success?: boolean; message?: string; msg?: string; data?: unknown };
    const root = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> | undefined : undefined;
    const password = typeof root?.password === "string" && /^\d{8}$/.test(root.password) ? root.password : "";
    const expiresIn = typeof root?.expiredSecond === "number" && root.expiredSecond > 0 ? root.expiredSecond : 30 * 60;
    if (!response.ok || payload.success !== true || !password) throw new Error(`OpenLock provider: ${payload.message || payload.msg || "temporary password failed"}`);
    return { password, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
  }
  users(lockId: string) { return this.request("users", { query: { lockId } }); }
}
