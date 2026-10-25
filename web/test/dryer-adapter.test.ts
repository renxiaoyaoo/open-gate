import assert from "node:assert/strict";
import test from "node:test";

const { dryerOperation } = await import("../lib/dryer-adapter.ts");

test("routes only fixed dryer adapter operations", () => {
  assert.deepEqual(dryerOperation("sms"), { method: "POST" });
  assert.deepEqual(dryerOperation("status"), { method: "GET" });
  assert.throws(() => dryerOperation("../../secrets"));
});
