import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const gateAccounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  mobileFingerprint: text("mobile_fingerprint"),
  mobileMask: text("mobile_mask").notNull(),
  displayName: text("display_name"),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("accounts_mobile_fingerprint").on(table.mobileFingerprint)]);

export const gateSessions = sqliteTable("sessions", {
  accountId: text("account_id").primaryKey().references(() => gateAccounts.id, { onDelete: "cascade" }),
  encryptedState: text("encrypted_state").notNull(),
  verifiedAt: integer("verified_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const gateDoors = sqliteTable("doors", {
  publicId: text("public_id"),
  accountId: text("account_id").notNull().references(() => gateAccounts.id, { onDelete: "cascade" }),
  communityId: integer("community_id").notNull(),
  doorControlId: integer("door_control_id").notNull(),
  name: text("name").notNull(),
  communityName: text("community_name"),
  communityCode: text("community_code"),
  mac: text("mac"),
  deviceModel: text("device_model"),
  passwordSupported: integer("password_supported", { mode: "boolean" }).notNull().default(false),
  providerFeatured: integer("provider_featured", { mode: "boolean" }).notNull().default(false),
  selected: integer("selected", { mode: "boolean" }),
  refreshedAt: integer("refreshed_at").notNull(),
}, (table) => [
  uniqueIndex("doors_public_id").on(table.publicId),
  uniqueIndex("doors_account_community_door").on(table.accountId, table.communityId, table.doorControlId),
]);

export const gateDoorPreferences = sqliteTable("door_preferences", {
  publicId: text("public_id").primaryKey(),
  displayOrder: integer("display_order").notNull(),
});

export const gateAuditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: text("account_id"),
  action: text("action").notNull(),
  target: text("target"),
  success: integer("success", { mode: "boolean" }).notNull(),
  message: text("message"),
  idempotencyKey: text("idempotency_key"),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("gate_audit_account_action_idempotency").on(table.accountId, table.action, table.idempotencyKey)]);
