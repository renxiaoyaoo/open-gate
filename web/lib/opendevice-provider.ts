import { createHmac, randomBytes } from "node:crypto";

export type OpenDeviceSession = { uid: string; accessToken: string; deviceId: string };
function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`OpenDevice provider configuration is incomplete (${name})`); return value; }
function stamp(now = new Date()) { return now.toISOString().replace(/[-:T]/g, "").slice(0, 14); }

export class OpenDeviceProvider {
  private readonly url = required("OPENDEVICE_PROVIDER_URL");
  private readonly appId = required("OPENDEVICE_PROVIDER_APP_ID");
  private readonly appKey = required("OPENDEVICE_PROVIDER_APP_KEY");
  private readonly iotKey = required("OPENDEVICE_PROVIDER_IOT_KEY");
  private readonly hmacKey = required("OPENDEVICE_PROVIDER_HMAC_KEY");
  readonly deviceId: string;
  private uid?: string;
  private accessToken?: string;

  constructor(session?: OpenDeviceSession) { this.deviceId = session?.deviceId || required("OPENDEVICE_PROVIDER_DEVICE_ID"); this.uid = session?.uid; this.accessToken = session?.accessToken; }
  private general(extra: Record<string, unknown> = {}) { return { src: this.appId, format: "2", stamp: stamp(), platformId: "1", deviceId: this.deviceId, reqId: randomBytes(16).toString("hex"), uid: this.uid, clientType: "1", appId: this.appId, language: "zh_CN", ...extra }; }
  private async request(alias: string, options: { method?: string; data?: unknown; query?: string; headers?: Record<string, string> } = {}) {
    const method = options.method || "POST"; const body = options.data === undefined ? "" : JSON.stringify(options.data); const nonce = String(Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", secretVersion: "1", random: nonce, sign: createHmac("sha256", this.hmacKey).update(`${this.iotKey}${body}${nonce}`).digest("hex"), ...options.headers };
    if (this.uid) headers.uid = this.uid; if (this.accessToken) headers.accessToken = this.accessToken;
    const response = await fetch(`${this.url}${alias}${options.query || ""}`, { method, headers, body: method === "GET" ? undefined : body, signal: AbortSignal.timeout(12_000) });
    const payload = await response.json().catch(() => ({ code: response.status, msg: "invalid response" })) as { code?: string | number; msg?: string; data?: unknown };
    if (!response.ok || String(payload.code) !== "0") throw new Error(`OpenDevice provider: ${payload.code ?? response.status} ${payload.msg || "request failed"}`); return payload.data;
  }
  requestSms(mobile: string) { return this.request("/mj/user/getSmsCode", { data: { data: { deviceId: this.deviceId }, iotData: { type: 9, mobile, iotAppId: this.appId }, timestamp: stamp() } }); }
  async smsLogin(mobile: string, smsCode: string) {
    const result = await this.request("/v6/mj/user/register", { data: { data: { appKey: this.appKey, appVersion: "11.7.15", deviceId: this.deviceId, deviceName: "OpenHome", osVersion: "Cloudflare", platform: 2 }, iotData: { mobile, smsCode, iotAppId: this.appId, appVersion: "11.7.15", deviceId: this.deviceId, loginType: 0 }, timestamp: stamp() } }) as { iotUserId?: string; userInfo?: { uid?: string; userId?: string }; mdata?: { accessToken?: string; userInfo?: { uid?: string } } };
    const uid = result.userInfo?.uid || result.userInfo?.userId || result.iotUserId || result.mdata?.userInfo?.uid; const accessToken = result.mdata?.accessToken;
    if (!uid || !accessToken) throw new Error("OpenDevice login response did not contain a session"); return { uid: String(uid), accessToken: String(accessToken), deviceId: this.deviceId };
  }
  listHomes() { return this.request("/v1/homegroup/list/get", { data: this.general() }); }
  listDevices(homeId: string) { return this.request("/v1/appliance/home/list/get", { data: this.general({ homegroupId: homeId }) }); }
  status(deviceId: string) { return this.thing("GET", `/v1/thing/properties/${deviceId}`); }
  program(deviceId: string, programId: number) { if (![2, 26, 42, 43].includes(programId)) throw new Error("Unsupported dryer program"); return this.thing("PUT", `/v1/thing/properties/${deviceId}`, { "dryer.currentDryingProgramId": programId }); }
  power(deviceId: string, power: boolean) { return this.thing("PUT", `/v1/thing/properties/${deviceId}`, { "dryer.power": power }); }
  action(deviceId: string, action: string, data: unknown) { if (!["startDrying", "pauseDrying", "appointmentDrying", "cancelAppointmentDrying"].includes(action)) throw new Error("Unsupported dryer action"); return this.thing("POST", `/v1/thing/action/dryer/${action}/${deviceId}`, data); }
  private thing(method: string, alias: string, data?: unknown) { return this.request(alias, { method, data, query: `?requestId=${randomBytes(16).toString("hex")}&sync=true`, headers: { caller: this.appId, "call-source": "mideaApp", "call-module": "appPlugin" } }); }
}
