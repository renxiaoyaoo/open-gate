import { callDryerAdapter, dryerOperation, type DryerOperation } from "@/lib/dryer-adapter";

type Context = { params: Promise<{ operation: string }> };

async function handle(request: Request, context: Context) {
  try {
    const { operation } = await context.params;
    dryerOperation(operation);
    return await callDryerAdapter(operation as DryerOperation, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "干衣机请求失败";
    const sessionExpired = /40002|token not exist/i.test(message);
    const response = Response.json({ ok: false, message: sessionExpired ? "登录已失效，请重新登录" : message }, { status: sessionExpired ? 401 : message.includes("配置") ? 503 : 502 });
    if (sessionExpired) response.headers.set("set-cookie", "openhome_opendevice=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    return response;
  }
}

export const GET = handle;
export const POST = handle;
