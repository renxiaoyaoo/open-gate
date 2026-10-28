import { callOpenLock } from "@/lib/openlock-adapter";
import { isAuthenticationExpired } from "@/lib/provider";

type Context = { params: Promise<{ operation: string }> };
async function handle(request: Request, context: Context) {
  try { return await callOpenLock((await context.params).operation, request); }
  catch (error) { const message = error instanceof Error ? error.message : "智能锁请求失败"; const sessionExpired = isAuthenticationExpired(error) || /invalid session data|unable to authenticate data/i.test(message); const response = Response.json({ ok: false, message: sessionExpired ? "登录已失效，请重新登录" : message }, { status: sessionExpired ? 401 : message.includes("配置") ? 503 : 502 }); if (sessionExpired) response.headers.set("set-cookie", "openhome_openlock_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"); return response; }
}
export const GET = handle;
export const POST = handle;
