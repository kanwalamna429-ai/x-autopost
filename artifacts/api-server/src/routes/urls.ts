import { Router, type IRouter } from "express";
import { db, urlsTable, campaignsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  AddUrlsBody,
  AddUrlsParams,
  DeleteUrlParams,
  ExtractUrlParams,
  GetCampaignUrlsParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { extractContent } from "../lib/content-extractor";

const router: IRouter = Router();
router.use(requireAuth);

const MAX_URLS_PER_CAMPAIGN = 500;

function formatUrl(url: Url): object {
  return {
    id: url.id,
    campaignId: url.campaignId,
    url: url.url,
    title: url.title ?? null,
    imageUrl: url.imageUrl ?? null,
    description: url.description ?? null,
    generatedImageUrl: url.generatedImageUrl ?? null,
    posted: url.posted,
    postedAt: url.postedAt?.toISOString() ?? null,
    failed: url.failed,
    failReason: url.failReason ?? null,
    createdAt: url.createdAt.toISOString(),
  };
}

import type { Url } from "@workspace/db";

router.get("/campaigns/:id/urls", async (req, res): Promise<void> => {
  const params = GetCampaignUrlsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const urls = await db.select().from(urlsTable)
    .where(eq(urlsTable.campaignId, params.data.id))
    .orderBy(urlsTable.createdAt);

  res.json(urls.map(formatUrl));
});

router.post("/campaigns/:id/urls", async (req, res): Promise<void> => {
  const params = AddUrlsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = AddUrlsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const campaignId = params.data.id;

  // Check campaign exists
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  // Get existing URLs to check for duplicates and count
  const existing = await db.select({ url: urlsTable.url }).from(urlsTable)
    .where(eq(urlsTable.campaignId, campaignId));
  const existingSet = new Set(existing.map((r) => r.url));
  const currentCount = existing.length;

  const inputUrls = parsed.data.urls
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  const unique = [...new Set(inputUrls)];
  const newUrls = unique.filter((u) => !existingSet.has(u));
  const duplicates = unique.length - newUrls.length;

  const available = MAX_URLS_PER_CAMPAIGN - currentCount;
  const toAdd = newUrls.slice(0, available);

  const addedUrls = [];

  for (const url of toAdd) {
    const [inserted] = await db.insert(urlsTable).values({
      campaignId,
      url,
      posted: false,
      failed: false,
    }).returning();

    addedUrls.push(inserted);

    // Extract content asynchronously (fire and forget for speed, then update)
    extractContent(url).then(async (content) => {
      await db.update(urlsTable)
        .set({ title: content.title, imageUrl: content.imageUrl, description: content.description })
        .where(eq(urlsTable.id, inserted.id));
    }).catch(() => {});
  }

  res.status(201).json({
    added: toAdd.length,
    duplicates,
    total: currentCount + toAdd.length,
    urls: addedUrls.map(formatUrl),
  });
});

router.delete("/campaigns/:campaignId/urls/:urlId", async (req, res): Promise<void> => {
  const params = DeleteUrlParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const [deleted] = await db.delete(urlsTable)
    .where(and(
      eq(urlsTable.id, params.data.urlId),
      eq(urlsTable.campaignId, params.data.campaignId)
    ))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "URL not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/campaigns/:campaignId/urls/:urlId/extract", async (req, res): Promise<void> => {
  const params = ExtractUrlParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const [urlRow] = await db.select().from(urlsTable)
    .where(and(
      eq(urlsTable.id, params.data.urlId),
      eq(urlsTable.campaignId, params.data.campaignId)
    ));

  if (!urlRow) {
    res.status(404).json({ error: "URL not found" });
    return;
  }

  const content = await extractContent(urlRow.url);

  const [updated] = await db.update(urlsTable)
    .set({ title: content.title, imageUrl: content.imageUrl, description: content.description })
    .where(eq(urlsTable.id, urlRow.id))
    .returning();

  res.json(formatUrl(updated));
});

export default router;
