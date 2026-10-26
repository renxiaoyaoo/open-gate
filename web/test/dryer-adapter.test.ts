import assert from "node:assert/strict";
import test from "node:test";

const { dryerOperation } = await import("../lib/dryer-adapter.ts");
const { DRYER_PROGRAMS, DRYER_PROGRAM_IDS } = await import("../lib/dryer-programs.ts");

test("routes only fixed dryer adapter operations", () => {
  assert.deepEqual(dryerOperation("sms"), { method: "POST" });
  assert.deepEqual(dryerOperation("status"), { method: "GET" });
  assert.deepEqual(dryerOperation("logout"), { method: "POST" });
  assert.deepEqual(dryerOperation("profile"), { method: "GET" });
  assert.deepEqual(dryerOperation("capabilities"), { method: "GET" });
  assert.throws(() => dryerOperation("../../secrets"));
});

test("publishes the complete generic 0xDC program catalog without duplicate ids", () => {
  assert.equal(DRYER_PROGRAMS.length, 50);
  assert.equal(DRYER_PROGRAM_IDS.size, 50);
  assert.equal(DRYER_PROGRAMS.find((item) => item.value === 43)?.name, "大件烘");
});
