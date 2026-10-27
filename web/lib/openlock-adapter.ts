import { cookies } from "next/headers";
import { OpenLockProvider, type OpenLockSession } from "./openlock-provider";
import { openSession, sealSession } from "./session-crypto";

const COOKIE = "openhome_openlock_session";
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };

export async function callOpenLock(operation: string, request: Request) {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  const session = raw ? openSession<OpenLockSession>(raw) : undefined;
  if (operation === "login") {
    const { password } = await request.json() as { password?: string };
    const next = await new OpenLockProvider().passwordLogin(password || "");
    jar.set(COOKIE, sealSession(next), cookieOptions);
    return Response.json({ ok: true, data: { displayName: next.displayName } });
  }
  if (operation === "logout") { jar.delete(COOKIE); return Response.json({ ok: true }); }
  if (!session) return Response.json({ ok: false, message: "请先登录" }, { status: 401 });
  const provider = new OpenLockProvider(session);
  const url = new URL(request.url); const lockId = url.searchParams.get("lockId") || "";
  let data: unknown;
  if (operation === "profile") data = { displayName: session.displayName };
  else if (operation === "devices") data = await provider.devices();
  else if (!lockId) throw new Error("缺少设备标识");
  else if (operation === "detail") data = await provider.detail(lockId);
  else if (operation === "security-logs") data = await provider.securityLogs(lockId, url.searchParams.get("type") || "0");
  else if (operation === "operation-logs") data = await provider.operationLogs(lockId);
  else if (operation === "temporary-password") data = await provider.temporaryPasswordCount(lockId);
  else if (operation === "captures") data = await provider.captures(lockId);
  else throw new Error("不支持的 OpenLock 操作");
  return Response.json({ ok: true, data });
}
