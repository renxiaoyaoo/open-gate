type AccessRoute = "login" | "profile" | "communities" | "homeItems" | "allItems" | "sortItems" | "operate" | "sms";
type DeviceRoute = "sms" | "login" | "homes" | "devices" | "templateMap" | "templateGet" | "properties" | "action";

export type ProviderBundle = {
  schemaVersion: 1;
  access: {
    baseUrls: Record<"mobile" | "app" | "gateway", string>;
    credentials: { appId: string; appSecret: string; encryptionKey: string; signingKey: string };
    client: { version: string; channel: string; vendor: string; versionCode: string; platform: string };
    routes: Record<AccessRoute, string>;
    passwordModels: string[];
  };
  device: {
    baseUrl: string;
    credentials: { appId: string; appKey: string; iotKey: string; hmacKey: string; deviceId: string };
    client: { version: string; secretVersion: string; platformId: string; clientType: string; language: string; source: string; module: string };
    routes: Record<DeviceRoute, string>;
    properties: { program: string; power: string };
    actions: Record<"start" | "pause" | "schedule" | "cancelSchedule", string>;
  };
};

let source = "";
let cached: ProviderBundle | undefined;

export function providerBundle(): ProviderBundle {
  const value = process.env.OPENHOME_PROVIDER_BUNDLE?.trim() || "";
  if (!value) throw new Error("Provider bundle is not configured");
  if (value === source && cached) return cached;
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("Provider bundle is invalid"); }
  const bundle = parsed as ProviderBundle;
  if (bundle?.schemaVersion !== 1 || !bundle.access?.baseUrls || !bundle.access?.credentials || !bundle.access?.routes || !bundle.device?.baseUrl || !bundle.device?.credentials || !bundle.device?.routes) {
    throw new Error("Provider bundle schema is unsupported");
  }
  source = value; cached = bundle; return bundle;
}

export function accessRoute(name: AccessRoute) {
  const route = providerBundle().access.routes[name];
  if (!route || route.startsWith("/") || route.includes("://")) throw new Error(`Provider route is invalid: ${name}`);
  return route;
}

export function deviceRoute(name: DeviceRoute, values: Record<string, string> = {}) {
  let route = providerBundle().device.routes[name];
  if (!route || route.includes("://")) throw new Error(`Provider route is invalid: ${name}`);
  for (const [key, value] of Object.entries(values)) route = route.replaceAll(`{${key}}`, encodeURIComponent(value));
  if (/\{[^}]+\}/.test(route)) throw new Error(`Provider route parameters are incomplete: ${name}`);
  return route;
}
