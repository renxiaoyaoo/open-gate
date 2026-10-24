import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";

const file = process.argv[2];
if (!file || process.argv[3] !== "--yes") {
  throw new Error("Usage: node rotate-session-key.mjs <private-env-file> --yes\nRotating this key invalidates every stored login session.");
}

const name = "OPENGATE_SESSION_ENCRYPTION_KEY";
const source = readFileSync(file, "utf8");
const value = randomBytes(32).toString("hex");
const line = new RegExp(`^${name}=.*$`, "m");
if (!line.test(source)) throw new Error(`Missing ${name} in ${file}`);
writeFileSync(file, source.replace(line, `${name}=${value}`), { mode: 0o600 });
chmodSync(file, 0o600);
console.log(`Rotated ${name} in ${file}. Sync secrets and re-login all accounts.`);
