import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const databaseId = process.env.OPENGATE_CF_DATABASE_ID;
const databaseName = process.env.OPENGATE_CF_DATABASE_NAME || "open-gate";
const customDomain = process.env.OPENGATE_CF_CUSTOM_DOMAIN || "";
const apiEnabled = process.env.OPENGATE_API_ENABLED === "1" ? "1" : "0";
if (!databaseId) throw new Error("Set OPENGATE_CF_DATABASE_ID in the private deployment environment");
if (customDomain && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(customDomain)) {
  throw new Error("OPENGATE_CF_CUSTOM_DOMAIN must be a hostname");
}
const template = readFileSync(resolve(root, "wrangler.template.jsonc"), "utf8");
const routes = customDomain
  ? `"routes": [{ "pattern": ${JSON.stringify(customDomain)}, "custom_domain": true }],`
  : "";
writeFileSync(
  resolve(root, "../../web/wrangler.production.jsonc"),
  template
    .replace("__DATABASE_ID__", databaseId)
    .replace("__DATABASE_NAME__", databaseName)
    .replace("__API_ENABLED__", apiEnabled)
    .replace("__ROUTES__", routes),
);
