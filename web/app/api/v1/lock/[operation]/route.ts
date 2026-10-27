import { callOpenLock } from "@/lib/openlock-adapter";

type Context = { params: Promise<{ operation: string }> };
async function handle(request: Request, context: Context) {
  try { return await callOpenLock((await context.params).operation, request); }
  catch (error) { const message = error instanceof Error ? error.message : "智能锁请求失败"; return Response.json({ ok: false, message }, { status: message.includes("配置") ? 503 : 502 }); }
}
export const GET = handle;
export const POST = handle;
