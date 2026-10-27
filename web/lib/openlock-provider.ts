import { createHash, randomUUID } from "node:crypto";
import { lockRoute, providerBundle } from "./provider-bundle.ts";

export type OpenLockSession = { token: string; displayName?: string };
type ProviderResponse = { status?: number | string; success?: boolean; msg?: string; data?: unknown };

function at(value: unknown, path: string): unknown {
  return path.split(".").filter(Boolean).reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value);
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

  async passwordLogin(password: string) {
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
    return { token, displayName: typeof displayName === "string" ? displayName : "OpenLock 账号" };
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
    const read = (field: keyof NonNullable<typeof this.config>["fields"]) => at(detail, this.config!.fields[field]);
    return { name: read("deviceName"), wifiName: read("wifiName"), wifiSignal: read("wifiSignal"), battery: read("battery"), cameraBattery: read("cameraBattery"), batteryUpdatedAt: read("batteryUpdatedAt") };
  }

  async captures(lockId: string) {
    const detailData = await this.request("detail", { query: { lockId } });
    const root = Array.isArray(detailData) ? detailData[0] : detailData;
    const detail = at(root, this.config!.fields.detail);
    const now = Math.floor(Date.now() / 1000);
    const values: Record<string, unknown> = {
      productId: at(detail, this.config!.fields.mediaProductId), deviceName: at(detail, this.config!.fields.mediaDeviceName),
      deviceId: lockId, startTime: now - 7 * 24 * 60 * 60, endTime: now, requestId: randomUUID(), thumbnails: [],
    };
    const mediaResponse = await fetch(new URL(this.config!.media.route, this.config!.media.baseUrl), { method: "POST", headers: { "content-type": "application/json;charset=utf-8" }, body: JSON.stringify(expand(this.config!.media.eventRequest, values)), signal: AbortSignal.timeout(15_000) });
    const mediaPayload = await mediaResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!mediaResponse.ok || String(at(mediaPayload, this.config!.media.successPath)) !== this.config!.media.successValue) throw new Error("OpenLock media event request failed");
    const eventsValue = at(mediaPayload, this.config!.fields.mediaEvents); const events = Array.isArray(eventsValue) ? eventsValue : [];
    const candidates = events.map((event) => ({ event, thumbnail: at(event, this.config!.fields.mediaThumbnail) })).filter((item): item is { event: unknown; thumbnail: string } => typeof item.thumbnail === "string" && Boolean(item.thumbnail));
    if (!candidates.length) return [];
    const signedData = await this.request("thumbnail", { method: "POST", json: expand(this.config!.media.thumbnailRequest, { ...values, thumbnails: candidates.map((item) => item.thumbnail) }) as Record<string, unknown> });
    const signedRoot = Array.isArray(signedData) ? signedData[0] : signedData;
    const signedValue = at(signedRoot, this.config!.fields.signedThumbnails); const signed = Array.isArray(signedValue) ? signedValue : [];
    return candidates.map(({ event }, index) => ({ id: String(at(event, this.config!.fields.mediaEventId) ?? index), time: Number(at(event, this.config!.fields.mediaEventTime) ?? 0), image: String(at(signed[index], this.config!.fields.signedThumbnailUrl) ?? "") })).filter((item) => item.image.startsWith("https://"));
  }

  private normalizeLogs(raw: unknown) {
    const groups = Array.isArray(raw) ? raw : [];
    return groups.flatMap((group) => { const items = at(group, this.config!.fields.logItems); return Array.isArray(items) ? items.map((item) => ({ time: String(at(item, this.config!.fields.logTime) ?? ""), content: String(at(item, this.config!.fields.logContent) ?? "") })) : []; });
  }
  async securityLogs(lockId: string, type = "0") { return this.normalizeLogs(await this.request("securityLogs", { query: { lockId, pageNumber: "1", pageSize: "20", type } })); }
  async operationLogs(lockId: string) { return this.normalizeLogs(await this.request("operationLogs", { method: "POST", json: { lockId, pageNumber: "1", pageSize: "20" } })); }
  async temporaryPasswordCount(lockId: string) { const raw = await this.request("temporaryPasswordCount", { query: { lockId } }); const root = Array.isArray(raw) ? raw[0] : raw; return { remaining: Number(at(root, this.config!.fields.temporaryPasswordCount) ?? 0) }; }
  async createTemporaryPassword(lockId: string) {
    const url = new URL(lockRoute("temporaryPasswordCreate"), this.config!.baseUrl);
    url.searchParams.set("lockId", lockId); url.searchParams.set("passwordEncrypt", "true");
    const response = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(12_000) });
    const payload = await response.json().catch(() => ({})) as { code?: unknown; success?: boolean; message?: string };
    const password = typeof payload.code === "string" && /^\d{6}$/.test(payload.code) ? payload.code : "";
    if (!response.ok || payload.success !== true || !password) throw new Error(`OpenLock provider: ${payload.message || "temporary password failed"}`);
    return { password, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
  }
  users(lockId: string) { return this.request("users", { query: { lockId } }); }
}
