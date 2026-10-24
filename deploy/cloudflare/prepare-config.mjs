import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const databaseId = process.env.OPENGATE_CF_DATABASE_ID;
const databaseName = process.env.OPENGATE_CF_DATABASE_NAME || "open-gate";
if (!databaseId) throw new Error("Set OPENGATE_CF_DATABASE_ID in the private deployment environment");
const template = readFileSync(resolve(root, "wrangler.template.jsonc"), "utf8");
writeFileSync(resolve(root, "../../web/wrangler.production.jsonc"), template.replace("__DATABASE_ID__", databaseId).replace("__DATABASE_NAME__", databaseName));
