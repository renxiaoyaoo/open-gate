import test from "node:test";
import assert from "node:assert/strict";

process.env.OPENHOME_SESSION_ENCRYPTION_KEY = "11".repeat(32);
const { lockMediaUrl, proxyLockMedia } = await import("../lib/lock-media.ts");

test("proxies and rewrites a signed HLS manifest", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("#EXTM3U\nsegment.ts?sign=x\n", { headers: { "content-type": "application/vnd.apple.mpegurl" } });
  try {
    const source = lockMediaUrl("https://video.example/clip.m3u8?sign=x");
    const token = new URL(source, "https://app.example").searchParams.get("token") || "";
    const response = await proxyLockMedia(new Request(`https://app.example${source}`), token);
    const body = await response.text();
    assert.match(body, /^#EXTM3U/m);
    assert.match(body, /\/api\/v1\/lock\/media\?token=/);
    assert.doesNotMatch(body, /video\.example/);
  } finally { globalThis.fetch = original; }
});
