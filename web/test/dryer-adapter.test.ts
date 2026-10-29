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
  assert.deepEqual(DRYER_PROGRAMS.filter(({ group }) => group !== "DIY").map(({ name, minutes, parameters }) => [name, minutes, parameters?.length || 0]), [
    ["混合", 100, 4], ["大件烘", 150, 4], ["小件烘", 50, 3], ["定时烘", 30, 1], ["热风暖衣", 30, 1], ["空气洗", 20, 1], ["快烘", 30, 0], ["冷风清新", 20, 1], ["除菌除螨", 180, 1], ["支架烘", 20, 2], ["晒被子", 45, 1], ["羊毛", 180, 1],
    ["羽绒服", 150, 1], ["棉麻", 110, 4], ["婴儿服", 90, 4], ["衬衫", 50, 4], ["浴巾", 95, 4], ["羊毛护理", 25, 0], ["内衣", 100, 4], ["运动服", 115, 4], ["牛仔", 160, 4],
  ]);
  assert.deepEqual(DRYER_PROGRAMS.filter((item) => item.parameters?.some(({ property }) => property === "dry_time_new")).map(({ name, parameters }) => [name, parameters?.find(({ property }) => property === "dry_time_new")?.values.map(({ value }) => value)]), [
    ["定时烘", Array.from({ length: 18 }, (_, index) => index * 10)], ["热风暖衣", [0, 10, 20, 30, 40, 50]], ["空气洗", [0, 5, 10, 15, 20, 25]], ["冷风清新", [0, 10, 20]], ["支架烘", Array.from({ length: 17 }, (_, index) => index * 10)], ["羊毛", [0, 60]], ["羽绒服", [0, 30, 60, 90]],
  ]);
});
