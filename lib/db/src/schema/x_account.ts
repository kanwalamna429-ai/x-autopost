import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const xAccountTable = pgTable("x_account", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  profileImageUrl: text("profile_image_url"),
  xUserId: text("x_user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertXAccountSchema = createInsertSchema(xAccountTable).omit({ id: true });
export type InsertXAccount = z.infer<typeof insertXAccountSchema>;
export type XAccount = typeof xAccountTable.$inferSelect;
