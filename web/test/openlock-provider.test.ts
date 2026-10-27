import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

const bundle = { schemaVersion: 1,
  access: { baseUrls: { mobile: "https://a.example", app: "https://a.example", gateway: "https://a.example" }, credentials: {}, client: {}, routes: {}, passwordModels: [] },
  device: { baseUrl: "https://d.example", credentials: {}, client: {}, routes: {}, properties: {}, actions: {} },
} as Record<string, unknown>;
(bundle as { lock?: unknown }).lock = {
  baseUrl: "https://lock.provider.example", identityCipher: "private-identity", client: { appVersion: "1", clientType: "test" },
  routes: { loginToken: "/login/token", login: "/login/password", devices: "/devices", detail: "/detail", securityLogs: "/logs/security", operationLogs: "/logs/operation", temporaryPasswordCount: "/password/count", users: "/users" },
  fields: { deviceId: "id", deviceName: "name", detail: "status", wifiName: "wifi", wifiSignal: "signal", battery: "battery", cameraBattery: "cameraBattery", batteryUpdatedAt: "updated", profileName: "nickname", logItems: "items", logTime: "time", logContent: "text", temporaryPasswordCount: "remaining" },
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
