import { Router, type IRouter } from "express";
import { db, campaignsTable, urlsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  CreateCampaignBody,
  UpdateCampaignBody,
  GetCampaignParams,
  UpdateCampaignParams,
  DeleteCampaignParams,
  GetCampaignStatsParams,
  TriggerCampaignParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { postForCampaign } from "../lib/scheduler";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/campaigns", async (req, res): Promise<void> => {
  const campaigns = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);

  const urlCounts = await db
    .select({ campaignId: urlsTable.campaignId, cnt: count() })
    .from(urlsTable)
    .groupBy(urlsTable.campaignId);

  const countMap = new Map(urlCounts.map((r) => [r.campaignId, Number(r.cnt)]));

  const result = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    frequencyHours: c.frequencyHours,
    recycleEnabled: c.recycleEnabled,
    postingMode: c.postingMode,
    addHashtags: c.addHashtags,
    ctaText: c.ctaText ?? null,
    lastPostedAt: c.lastPostedAt?.toISOString() ?? null,
    nextPostAt: c.nextPostAt?.toISOString() ?? null,
    urlCount: countMap.get(c.id) ?? 0,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/campaigns", async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const frequencyHours = parsed.data.frequencyHours;
  const nextPostAt = new Date(Date.now() + frequencyHours * 60 * 60 * 1000);

  const [campaign] = await db.insert(campaignsTable).values({
    name: parsed.data.name,
    status: parsed.data.status ?? "active",
    frequencyHours,
    recycleEnabled: parsed.data.recycleEnabled ?? false,
    postingMode: parsed.data.postingMode,
    addHashtags: parsed.data.addHashtags ?? false,
    ctaText: parsed.data.ctaText ?? null,
    nextPostAt,
  }).returning();

  res.status(201).json({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    frequencyHours: campaign.frequencyHours,
    recycleEnabled: campaign.recycleEnabled,
    postingMode: campaign.postingMode,
    addHashtags: campaign.addHashtags,
    ctaText: campaign.ctaText ?? null,
    lastPostedAt: null,
    nextPostAt: campaign.nextPostAt?.toISOString() ?? null,
    urlCount: 0,
    createdAt: campaign.createdAt.toISOString(),
  });
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, params.data.id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const [urlCount] = await db
    .select({ cnt: count() })
    .from(urlsTable)
    .where(eq(urlsTable.campaignId, campaign.id));

  res.json({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    frequencyHours: campaign.frequencyHours,
    recycleEnabled: campaign.recycleEnabled,
    postingMode: campaign.postingMode,
    addHashtags: campaign.addHashtags,
    ctaText: campaign.ctaText ?? null,
    lastPostedAt: campaign.lastPostedAt?.toISOString() ?? null,
    nextPostAt: campaign.nextPostAt?.toISOString() ?? null,
    urlCount: Number(urlCount?.cnt ?? 0),
    createdAt: campaign.createdAt.toISOString(),
  });
});

router.patch("/campaigns/:id", async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.frequencyHours !== undefined) updateData.frequencyHours = parsed.data.frequencyHours;
  if (parsed.data.recycleEnabled !== undefined) updateData.recycleEnabled = parsed.data.recycleEnabled;
  if (parsed.data.postingMode !== undefined) updateData.postingMode = parsed.data.postingMode;
  if (parsed.data.addHashtags !== undefined) updateData.addHashtags = parsed.data.addHashtags;
  if ("ctaText" in parsed.data) updateData.ctaText = parsed.data.ctaText ?? null;

  const [campaign] = await db.update(campaignsTable)
    .set(updateData)
    .where(eq(campaignsTable.id, params.data.id))
    .returning();

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const [urlCount] = await db
    .select({ cnt: count() })
    .from(urlsTable)
    .where(eq(urlsTable.campaignId, campaign.id));

  res.json({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    frequencyHours: campaign.frequencyHours,
    recycleEnabled: campaign.recycleEnabled,
    postingMode: campaign.postingMode,
    addHashtags: campaign.addHashtags,
    ctaText: campaign.ctaText ?? null,
    lastPostedAt: campaign.lastPostedAt?.toISOString() ?? null,
    nextPostAt: campaign.nextPostAt?.toISOString() ?? null,
    urlCount: Number(urlCount?.cnt ?? 0),
    createdAt: campaign.createdAt.toISOString(),
  });
});

router.delete("/campaigns/:id", async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db.delete(campaignsTable)
    .where(eq(campaignsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/campaigns/:id/stats", async (req, res): Promise<void> => {
  const params = GetCampaignStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select({
      posted: urlsTable.posted,
      failed: urlsTable.failed,
      cnt: count(),
    })
    .from(urlsTable)
    .where(eq(urlsTable.campaignId, params.data.id))
    .groupBy(urlsTable.posted, urlsTable.failed);

  let total = 0, posted = 0, failed = 0, pending = 0;
  for (const row of rows) {
    const n = Number(row.cnt);
    total += n;
    if (row.posted) posted += n;
    else if (row.failed) failed += n;
    else pending += n;
  }

  res.json({ total, pending, posted, failed });
});

router.post("/campaigns/:id/trigger", async (req, res): Promise<void> => {
  const params = TriggerCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const result = await postForCampaign(params.data.id);
  if (!result.success) {
    logger.warn({ campaignId: params.data.id, message: result.message }, "Trigger: post failed");
  } else {
    logger.info({ campaignId: params.data.id, tweetUrl: result.tweetUrl }, "Trigger: post succeeded");
  }
  res.json(result);
});

export default router;
