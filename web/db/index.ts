import { AsyncLocalStorage } from "node:async_hooks";

export interface Statement {
  bind(...values: SqlValue[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
type SqlValue = string | number | bigint | Uint8Array | null;
export interface Database { prepare(sql: string): Statement; }

const runtimeDatabase = new AsyncLocalStorage<Database>();
let nodeDatabase: Promise<Database> | undefined;

export function withDatabase<T>(database: Database, operation: () => T): T { return runtimeDatabase.run(database, operation); }
export async function getDb(): Promise<Database> { const bound = runtimeDatabase.getStore(); if (bound) return bound; nodeDatabase ??= createNodeDatabase(); return nodeDatabase; }

async function createNodeDatabase(): Promise<Database> {
  const [{ DatabaseSync }, { mkdir }, { dirname, resolve }] = await Promise.all([import("node:sqlite"), import("node:fs/promises"), import("node:path")]);
  const filename = resolve(process.env.OPENGATE_DATABASE_PATH || "./data/open-gate.sqlite");
  await mkdir(dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;"); sqlite.exec(SCHEMA);
  return { prepare(sql) { const statement = sqlite.prepare(sql); let values: SqlValue[] = []; return { bind(...next) { values = next; return this; }, async first<T>() { return (statement.get(...values) as T | undefined) ?? null; }, async all<T>() { return { results: statement.all(...values) as T[] }; }, async run() { return statement.run(...values); } }; } };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, mobile_fingerprint TEXT UNIQUE, mobile_mask TEXT NOT NULL, display_name TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, encrypted_state TEXT NOT NULL, verified_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS doors (public_id TEXT UNIQUE, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, community_id INTEGER NOT NULL, door_control_id INTEGER NOT NULL, name TEXT NOT NULL, community_name TEXT, community_code TEXT, mac TEXT, device_model TEXT, password_supported INTEGER NOT NULL DEFAULT 0, provider_featured INTEGER NOT NULL DEFAULT 0, selected INTEGER, refreshed_at INTEGER NOT NULL, UNIQUE(account_id, community_id, door_control_id));
CREATE TABLE IF NOT EXISTS door_preferences (public_id TEXT PRIMARY KEY, display_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT, action TEXT NOT NULL, target TEXT, success INTEGER NOT NULL, message TEXT, idempotency_key TEXT, created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS audit_account_action_idempotency ON audit_logs(account_id, action, idempotency_key);
`;
