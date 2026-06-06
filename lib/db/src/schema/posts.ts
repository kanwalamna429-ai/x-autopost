import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { urlsTable } from "./urls";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  urlId: integer("url_id").references(() => urlsTable.id, { onDelete: "set null" }),
  tweetId: text("tweet_id"),
  tweetUrl: text("tweet_url"),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("success"), // success | failed
  errorMessage: text("error_message"),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
