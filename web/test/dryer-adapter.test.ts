import assert from "node:assert/strict";
import test from "node:test";

process.env.MIDEA_DRYER_ADAPTER_URL = "http://adapter.example/internal/";
const { dryerAdapterUrl, dryerOperation } = await import("../lib/dryer-adapter.ts");

test("routes only fixed dryer adapter operations", () => {
  assert.deepEqual(dryerOperation("sms"), { method: "POST", path: "api/login/sms/request" });
  assert.deepEqual(dryerOperation("status"), { method: "GET", path: "api/dryer/status" });
  assert.throws(() => dryerOperation("../../secrets"));
});

test("keeps the configured adapter origin and forwards only query parameters", () => {
  const url = dryerAdapterUrl("status", "?deviceId=opaque-device");
  assert.equal(url.origin, "http://adapter.example");
  assert.equal(url.pathname, "/internal/api/dryer/status");
  assert.equal(url.searchParams.get("deviceId"), "opaque-device");
});
