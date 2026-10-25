import { callDryerAdapter, dryerOperation, type DryerOperation } from "@/lib/dryer-adapter";

type Context = { params: Promise<{ operation: string }> };

async function handle(request: Request, context: Context) {
  try {
    const { operation } = await context.params;
    dryerOperation(operation);
    return await callDryerAdapter(operation as DryerOperation, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "干衣机请求失败";
    return Response.json({ ok: false, message }, { status: message.includes("配置") ? 503 : 502 });
  }
}

export const GET = handle;
export const POST = handle;
