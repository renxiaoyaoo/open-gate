import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envFile = process.argv[2];
const wranglerConfig = process.argv[3] || "wrangler.production.jsonc";
if (!envFile) throw new Error("Usage: node sync-secrets.mjs <private-env-file> [wrangler-config]");

const secretNames = new Set([
  "OPENGATE_PROVIDER_MOBILE_URL",
  "OPENGATE_PROVIDER_APP_URL",
  "OPENGATE_PROVIDER_GATEWAY_URL",
  "OPENGATE_PROVIDER_APP_ID",
  "OPENGATE_PROVIDER_APP_SECRET",
  "OPENGATE_PROVIDER_MOBILE_AES_KEY",
  "OPENGATE_PROVIDER_SIGNING_KEY",
  "OPENGATE_SESSION_ENCRYPTION_KEY",
  "OPENDEVICE_PROVIDER_URL",
  "OPENDEVICE_PROVIDER_APP_ID",
  "OPENDEVICE_PROVIDER_APP_KEY",
  "OPENDEVICE_PROVIDER_IOT_KEY",
  "OPENDEVICE_PROVIDER_HMAC_KEY",
  "OPENDEVICE_PROVIDER_DEVICE_ID",
]);

const values = new Map();
for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator > 0) values.set(line.slice(0, separator), line.slice(separator + 1));
}

for (const name of secretNames) {
  const value = values.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  const result = spawnSync(
    "./node_modules/.bin/wrangler",
    ["secret", "put", name, "--config", wranglerConfig],
    { input: `${value}\n`, encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Failed to sync ${name}\n`);
    process.exit(result.status || 1);
  }
  console.log(`Synced ${name}`);
}
