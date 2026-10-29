import { openSession, sealSession } from "./session-crypto.ts";

type MediaHandle = { url: string; expiresAt: number };

export function lockMediaUrl(url: string) {
  return `/api/v1/lock/media?token=${encodeURIComponent(sealSession({ url, expiresAt: Date.now() + 55 * 60_000 } satisfies MediaHandle))}`;
}

function mediaTarget(token: string) {
  const handle = openSession<MediaHandle>(token);
  if (!handle || typeof handle.url !== "string" || typeof handle.expiresAt !== "number" || handle.expiresAt < Date.now()) throw new Error("媒体链接已失效");
  const url = new URL(handle.url);
  if (url.protocol !== "https:") throw new Error("媒体链接无效");
  return url;
}

export async function proxyLockMedia(request: Request, token: string) {
  const target = mediaTarget(token);
  const headers = new Headers(); const range = request.headers.get("range"); if (range) headers.set("range", range);
  const upstream = await fetch(target, { headers, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  if (!upstream.ok && upstream.status !== 206) throw new Error("媒体加载失败");
  const type = upstream.headers.get("content-type") || "application/octet-stream";
  if (/mpegurl|m3u8/i.test(type) || target.pathname.endsWith(".m3u8")) {
    const manifest = await upstream.text();
    const wrap = (value: string) => lockMediaUrl(new URL(value, target).toString());
    const body = manifest.split(/\r?\n/).map((line) => line && !line.startsWith("#") ? wrap(line) : line.replace(/URI="([^"]+)"/g, (_match, value: string) => `URI="${wrap(value)}"`)).join("\n");
    return new Response(body, { headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": "private, max-age=30" } });
  }
  const responseHeaders = new Headers({ "content-type": type, "cache-control": "private, max-age=60", "accept-ranges": upstream.headers.get("accept-ranges") || "bytes" });
  for (const name of ["content-length", "content-range"]) { const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value); }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
