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
  const filename = resolve(process.env.OPENHOME_DATABASE_PATH || "./data/open-home.sqlite");
  await mkdir(dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;"); sqlite.exec(SCHEMA); sqlite.exec(LEGACY_CLEANUP);
  return { prepare(sql) { const statement = sqlite.prepare(sql); let values: SqlValue[] = []; return { bind(...next) { values = next; return this; }, async first<T>() { return (statement.get(...values) as T | undefined) ?? null; }, async all<T>() { return { results: statement.all(...values) as T[] }; }, async run() { return statement.run(...values); } }; } };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, mobile_fingerprint TEXT UNIQUE, mobile_mask TEXT NOT NULL, display_name TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, encrypted_state TEXT NOT NULL, verified_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
`;

const LEGACY_CLEANUP = `
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS door_preferences;
DROP TABLE IF EXISTS doors;
`;
