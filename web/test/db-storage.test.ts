import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("center storage contains only accounts and encrypted sessions", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "open-home-db-"));
  process.env.OPENHOME_DATABASE_PATH = resolve(directory, "open-home.sqlite");
  process.env.OPENHOME_SESSION_ENCRYPTION_KEY = "11".repeat(32);
  try {
    const { getDb } = await import("../db/index.ts");
    const { loadProviderSession, publicAccounts, saveProviderSession } = await import("../lib/central.ts");
    const db = await getDb();
    const rows = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all<{ name: string }>();
    assert.deepEqual(rows.results.map((row) => row.name), ["accounts", "sessions"]);
    await saveProviderSession("opendevice", "od-test", "13800138000", "Appliance", { accessToken: "device-token" });
    await saveProviderSession("openlock", "ol-test", "13800138000", "Lock", { token: "lock-token" });
    assert.deepEqual((await loadProviderSession<{ accessToken: string }>("opendevice")).session, { accessToken: "device-token" });
    assert.deepEqual((await loadProviderSession<{ token: string }>("openlock")).session, { token: "lock-token" });
    assert.deepEqual((await publicAccounts("opendevice")).map(({ id, provider }) => ({ id, provider })), [{ id: "od-test", provider: "opendevice" }]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
