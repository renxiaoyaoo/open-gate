const OPERATIONS = {
  sms: { method: "POST", path: "api/login/sms/request" },
  login: { method: "POST", path: "api/login/sms/verify" },
  homes: { method: "GET", path: "api/homes" },
  devices: { method: "GET", path: "api/devices" },
  status: { method: "GET", path: "api/dryer/status" },
  program: { method: "POST", path: "api/dryer/program" },
  power: { method: "POST", path: "api/dryer/power" },
  action: { method: "POST", path: "api/dryer/action" },
} as const;

export type DryerOperation = keyof typeof OPERATIONS;

export function dryerOperation(value: string) {
  if (!(value in OPERATIONS)) throw new Error("不支持的干衣机操作");
  return OPERATIONS[value as DryerOperation];
}

export function dryerAdapterUrl(operation: DryerOperation, search = "") {
  const configured = process.env.MIDEA_DRYER_ADAPTER_URL?.trim();
  if (!configured) throw new Error("尚未配置干衣机适配器");
  const base = new URL(configured.endsWith("/") ? configured : `${configured}/`);
  if (!/^https?:$/.test(base.protocol)) throw new Error("干衣机适配器地址无效");
  const url = new URL(OPERATIONS[operation].path, base);
  url.search = search;
  return url;
}

export async function callDryerAdapter(operation: DryerOperation, request: Request) {
  const spec = OPERATIONS[operation];
  if (request.method !== spec.method) return new Response(JSON.stringify({ ok: false, message: "请求方法不支持" }), { status: 405, headers: { "content-type": "application/json" } });
  const sourceUrl = new URL(request.url);
  const headers: Record<string, string> = { accept: "application/json" };
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const body = spec.method === "POST" ? await request.text() : undefined;
  if (body) headers["content-type"] = "application/json";
  const response = await fetch(dryerAdapterUrl(operation, sourceUrl.search).toString(), { method: spec.method, headers, body, signal: AbortSignal.timeout(12_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof payload.error === "string" ? payload.error : typeof payload.message === "string" ? payload.message : "干衣机适配器请求失败";
  const result = Response.json(response.ok ? { ok: true, data: payload } : { ok: false, message }, { status: response.ok ? 200 : response.status });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) result.headers.set("set-cookie", setCookie);
  return result;
}
