import { createHmac } from "node:crypto";
import { getDb } from "@/db";
import type { ProviderRequestContext } from "./provider";
import { openSession, sealSession } from "./session-crypto";

export type CentralSession = { sessionId: string; signingToken: string; openId: string; context: ProviderRequestContext };

export function assertCentralEnabled() { if (process.env.OPENHOME_ACCESS_ENABLED !== "1") throw new Error("OpenAPI is disabled until access control is configured"); }
function encryptionKey() { const value = process.env.OPENHOME_SESSION_ENCRYPTION_KEY || ""; const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64"); if (key.length !== 32) throw new Error("Session encryption key is not configured"); return key; }
export function validAccountId(value: string) { if (!/^[a-z0-9][a-z0-9_-]{0,47}$/i.test(value)) throw new Error("Invalid account ID"); return value; }
export function maskMobile(mobile: string) { return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`; }
function mobileFingerprint(mobile: string) { return createHmac("sha256", encryptionKey()).update(mobile).digest("hex"); }

export async function saveCentralSession(accountId: string, mobile: string, displayName: string | null, session: CentralSession) { const db = await getDb(); const now = Date.now(); const fingerprint = mobileFingerprint(mobile); const existing = await db.prepare("SELECT id FROM accounts WHERE mobile_fingerprint=?").bind(fingerprint).first<{ id: string }>(); const id = existing?.id || accountId; await db.prepare("INSERT INTO accounts (id,mobile_fingerprint,mobile_mask,display_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET mobile_fingerprint=excluded.mobile_fingerprint,mobile_mask=excluded.mobile_mask,display_name=excluded.display_name,status='active',updated_at=excluded.updated_at").bind(id, fingerprint, maskMobile(mobile), displayName, "active", now, now).run(); await db.prepare("INSERT INTO sessions (account_id,encrypted_state,verified_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET encrypted_state=excluded.encrypted_state,verified_at=excluded.verified_at,updated_at=excluded.updated_at").bind(id, sealSession(session), now, now).run(); return id; }
export async function loadCentralSession(accountId: string) { const row = await (await getDb()).prepare("SELECT encrypted_state AS encryptedState FROM sessions WHERE account_id=?").bind(accountId).first<{ encryptedState: string }>(); if (!row) throw new Error("Account is not signed in"); return openSession<CentralSession>(row.encryptedState); }
export async function persistCentralSession(accountId: string, session: CentralSession) { await (await getDb()).prepare("UPDATE sessions SET encrypted_state=?,updated_at=? WHERE account_id=?").bind(sealSession(session), Date.now(), accountId).run(); }
export async function listAccounts() { return (await (await getDb()).prepare("SELECT id,display_name AS displayName,mobile_mask AS mobileMask,status,updated_at AS updatedAt FROM accounts ORDER BY updated_at DESC").all<{ id: string; displayName: string | null; mobileMask: string; status: string; updatedAt: number }>()).results; }
export async function publicAccounts() { return (await listAccounts()).filter((row) => row.status === "active").map((row) => ({ id: row.id, username: row.displayName || row.mobileMask })); }
export async function removeAccount(accountId: string) { const db = await getDb(); const row = await db.prepare("SELECT id FROM accounts WHERE id=?").bind(accountId).first(); if (!row) throw new Error("Account not found"); await db.prepare("DELETE FROM accounts WHERE id=?").bind(accountId).run(); }
export async function listActiveAccountIds() { return (await (await getDb()).prepare("SELECT id FROM accounts WHERE status='active'").all<{ id: string }>()).results.map((row) => row.id); }
