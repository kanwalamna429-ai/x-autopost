import { pgTable, text, serial, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"), // active | paused
  frequencyHours: real("frequency_hours").notNull().default(24),
  recycleEnabled: boolean("recycle_enabled").notNull().default(false),
  postingMode: text("posting_mode").notNull().default("sequential"), // sequential | random
  addHashtags: boolean("add_hashtags").notNull().default(false),
  ctaText: text("cta_text"),
  lastPostedAt: timestamp("last_posted_at", { withTimezone: true }),
  nextPostAt: timestamp("next_post_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
