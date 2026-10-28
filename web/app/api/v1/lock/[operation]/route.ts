import { callOpenLock } from "@/lib/openlock-adapter";

type Context = { params: Promise<{ operation: string }> };
async function handle(request: Request, context: Context) {
  try { return await callOpenLock((await context.params).operation, request); }
  catch (error) { const message = error instanceof Error ? error.message : "智能锁请求失败"; const status = /未登录|重新登录|token.*(?:不存在|失效|过期)|session.*(?:expired|invalid)/i.test(message) ? 401 : message.includes("配置") ? 503 : 502; return Response.json({ ok: false, message }, { status }); }
}
export const GET = handle;
export const POST = handle;
