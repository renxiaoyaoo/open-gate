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
