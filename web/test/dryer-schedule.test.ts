import assert from "node:assert/strict";
import test from "node:test";
import { appointmentDelay, finishAt } from "../lib/dryer-schedule.ts";

test("converts the chosen start time to the provider's completion delay", () => {
  const now = new Date("2026-10-28T16:00:00+08:00");
  assert.equal(finishAt("23:00", { minutes: 150 }, now), "01:30");
  assert.equal(appointmentDelay("23:00", { minutes: 150 }, now), 570);
});

test("keeps a past start time on the next day before adding program duration", () => {
  const now = new Date("2026-10-28T23:30:00+08:00");
  assert.equal(appointmentDelay("23:00", { minutes: 150 }, now), 1_560);
});
