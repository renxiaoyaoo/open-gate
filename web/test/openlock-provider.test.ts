import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

const bundle = { schemaVersion: 1,
  access: { baseUrls: { mobile: "https://a.example", app: "https://a.example", gateway: "https://a.example" }, credentials: {}, client: {}, routes: {}, passwordModels: [] },
  device: { baseUrl: "https://d.example", credentials: {}, client: {}, routes: {}, properties: {}, actions: {} },
} as Record<string, unknown>;
(bundle as { lock?: unknown }).lock = {
  baseUrl: "https://lock.provider.example", identityCipher: "private-identity", client: { appVersion: "1", clientType: "test" },
  routes: { loginToken: "/login/token", login: "/login/password", devices: "/devices", detail: "/detail", securityLogs: "/logs/security", operationLogs: "/logs/operation", temporaryPasswordCount: "/password/count", temporaryPasswordCreate: "/password/create", users: "/users", thumbnail: "/media/sign" },
  media: { baseUrl: "https://media.provider.example", route: "/events", successPath: "result", successValue: "ok", eventRequest: { credential: "private-media-token", product: "{productId}", device: "{deviceName}", from: "{startTime}", to: "{endTime}" }, thumbnailRequest: { action: "private-action", device: "{deviceId}", paths: "{thumbnails}" } },
  fields: { deviceId: "id", deviceName: "name", detail: "status", wifiName: "wifi", wifiSignal: "signal", battery: "battery", cameraBattery: "cameraBattery", batteryUpdatedAt: "updated", profileName: "nickname", logItems: "items", logTime: "time", logContent: "text", temporaryPasswordCount: "remaining", mediaProductId: "product", mediaDeviceName: "mediaName", mediaEvents: "payload.events", mediaEventId: "eventId", mediaEventTime: "created", mediaThumbnail: "thumbnail", signedThumbnails: "signed", signedThumbnailUrl: "url" },
};
process.env.OPENHOME_PROVIDER_BUNDLE = JSON.stringify(bundle);
const { OpenLockProvider } = await import("../lib/openlock-provider.ts");

test("logs in with the configured private identity and password digest", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const data = calls.length === 1 ? ["challenge"] : [{ token: "session-token", nickname: "Home" }];
    return Response.json({ status: 1, success: true, data });
  };
  try { assert.deepEqual(await new OpenLockProvider().passwordLogin("secret"), { token: "session-token", displayName: "Home" }); }
  finally { globalThis.fetch = original; }
  assert.equal(new URL(calls[0].url).searchParams.get("encryptUserPhone"), "private-identity");
  const form = new URLSearchParams(String(calls[1].init?.body));
  assert.equal(form.get("loginToken"), "challenge");
  assert.equal(form.get("passWord2"), createHash("md5").update("secret").digest("hex"));
  assert.equal(form.get("encryptUserPhone"), "private-identity");
});

test("builds media requests from private templates and returns signed captures", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input); const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ url, body });
    if (url.includes("/events")) return Response.json({ result: "ok", payload: { events: [{ eventId: "first", created: 10, thumbnail: "a" }, { eventId: "skip", created: 11 }, { eventId: "second", created: 12, thumbnail: "b" }] } });
    if (url.includes("/media/sign")) return Response.json({ status: 1, success: true, data: [{ signed: [{ url: "https://images.example/a" }, { url: "https://images.example/b" }] }] });
    return Response.json({ status: 1, success: true, data: [{ status: { product: "product-1", mediaName: "device-1", mediaId: "id-1" } }] });
  };
  try {
    const result = await new OpenLockProvider({ token: "session" }).captures("7");
    assert.deepEqual(result, [{ id: "first", time: 10, image: "https://images.example/a" }, { id: "second", time: 12, image: "https://images.example/b" }]);
  } finally { globalThis.fetch = original; }
  assert.equal(calls[1].body.product, "product-1");
  assert.equal(calls[2].body.device, "7");
  assert.deepEqual(calls[2].body.paths, ["a", "b"]);
});

test("normalizes device status, records, and temporary password capacity", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    const data = path === "/devices" ? [{ id: "7", name: "Front" }]
      : path === "/detail" ? [{ status: { name: "Front", wifi: "Home", signal: "good", battery: "80", cameraBattery: "70", updated: "today" } }]
      : path === "/password/count" ? [{ remaining: 4 }]
      : [{ items: [{ time: "now", text: "opened" }] }];
    return Response.json({ status: 1, success: true, data });
  };
  try {
    const provider = new OpenLockProvider({ token: "session" });
    assert.deepEqual(await provider.devices(), [{ id: "7", name: "Front" }]);
    assert.deepEqual(await provider.detail("7"), { name: "Front", wifiName: "Home", wifiSignal: "good", battery: "80", cameraBattery: "70", batteryUpdatedAt: "today" });
    assert.deepEqual(await provider.securityLogs("7"), [{ time: "now", content: "opened" }]);
    assert.deepEqual(await provider.temporaryPasswordCount("7"), { remaining: 4 });
  } finally { globalThis.fetch = original; }
});

test("creates a six-digit temporary password with the observed query contract", async () => {
  const original = globalThis.fetch; let requested = "";
  globalThis.fetch = async (input) => { requested = String(input); return Response.json({ success: true, code: "123456" }); };
  try {
    const before = Date.now(); const result = await new OpenLockProvider({ token: "session" }).createTemporaryPassword("7");
    assert.equal(result.password, "123456"); assert.ok(Date.parse(result.expiresAt) >= before + 30 * 60 * 1000);
  } finally { globalThis.fetch = original; }
  const url = new URL(requested); assert.equal(url.searchParams.get("lockId"), "7"); assert.equal(url.searchParams.get("passwordEncrypt"), "true");
});
