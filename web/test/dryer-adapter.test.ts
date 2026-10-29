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

test("publishes the observed target dryer programs and recommended DIY", () => {
  assert.equal(DRYER_PROGRAMS.length, 22);
  assert.equal(DRYER_PROGRAM_IDS.size, 21);
  assert.deepEqual([...DRYER_PROGRAM_IDS].sort((a, b) => a - b), [0, 2, 3, 6, 8, 10, 11, 12, 13, 14, 15, 17, 22, 26, 28, 39, 42, 43, 44, 45, 83]);
  const large = DRYER_PROGRAMS.find((item) => item.value === 43);
  assert.equal(large?.name, "大件烘");
  assert.equal(large?.minutes, 150);
  assert.equal(large?.group, "日常程序");
  assert.equal(DRYER_PROGRAMS.find((item) => item.value === 26)?.group, "日常程序");
  assert.deepEqual(DRYER_PROGRAMS.filter(({ group }) => group === "特定材质").map(({ name }) => name), ["羽绒服", "棉麻", "婴儿服", "衬衫", "浴巾", "羊毛护理", "内衣", "运动服", "牛仔"]);
  assert.deepEqual(DRYER_PROGRAMS.filter(({ group }) => group === "DIY").map(({ name, value }) => ({ name, value })), [{ name: "花粉过敏烘", value: 83 }]);
  assert.deepEqual(large?.parameters?.map(({ property }) => property), ["temperature_level", "dry_level", "dry_temp", "crease_resist_old"]);
  assert.equal(DRYER_PROGRAMS.find((item) => item.value === 83)?.parameters?.[0]?.values[2]?.value, 3);
  assert.equal(DRYER_PROGRAMS.find((item) => item.name === "羊毛")?.parameters?.[0]?.values[0]?.label, "+0分");
  assert.equal(DRYER_PROGRAMS.filter((item) => item.description).length, 2);
});
