import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";

export const urlsTable = pgTable("urls", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  imageUrl: text("image_url"),
  description: text("description"),
  generatedImageUrl: text("generated_image_url"),
  posted: boolean("posted").notNull().default(false),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  failed: boolean("failed").notNull().default(false),
  failReason: text("fail_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUrlSchema = createInsertSchema(urlsTable).omit({ id: true, createdAt: true });
export type InsertUrl = z.infer<typeof insertUrlSchema>;
export type Url = typeof urlsTable.$inferSelect;
