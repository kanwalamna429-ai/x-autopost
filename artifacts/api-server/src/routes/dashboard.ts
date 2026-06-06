import { Router, type IRouter } from "express";
import { db, campaignsTable, urlsTable, postsTable, xAccountTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [campaignStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where status = 'active')`,
    })
    .from(campaignsTable);

  const [urlStats] = await db
    .select({
      total: count(),
      pending: sql<number>`count(*) filter (where posted = false and failed = false)`,
    })
    .from(urlsTable);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [postStats] = await db
    .select({
      totalAllTime: count(),
      totalToday: sql<number>`count(*) filter (where posted_at >= ${today.toISOString()})`,
    })
    .from(postsTable);

  // Recent posts with joins
  const recentRows = await db
    .select({
      id: postsTable.id,
      campaignId: postsTable.campaignId,
      campaignName: campaignsTable.name,
      urlId: postsTable.urlId,
      articleUrl: urlsTable.url,
      articleTitle: urlsTable.title,
      tweetId: postsTable.tweetId,
      tweetUrl: postsTable.tweetUrl,
      postedAt: postsTable.postedAt,
      status: postsTable.status,
      errorMessage: postsTable.errorMessage,
    })
    .from(postsTable)
    .leftJoin(campaignsTable, eq(postsTable.campaignId, campaignsTable.id))
    .leftJoin(urlsTable, eq(postsTable.urlId, urlsTable.id))
    .orderBy(sql`${postsTable.postedAt} desc`)
    .limit(10);

  res.json({
    totalCampaigns: Number(campaignStats?.total ?? 0),
    activeCampaigns: Number(campaignStats?.active ?? 0),
    totalUrls: Number(urlStats?.total ?? 0),
    pendingUrls: Number(urlStats?.pending ?? 0),
    totalPostsToday: Number(postStats?.totalToday ?? 0),
    totalPostsAllTime: Number(postStats?.totalAllTime ?? 0),
    recentPosts: recentRows.map((r) => ({
      id: r.id,
      campaignId: r.campaignId,
      campaignName: r.campaignName ?? null,
      urlId: r.urlId ?? null,
      articleUrl: r.articleUrl ?? null,
      articleTitle: r.articleTitle ?? null,
      tweetId: r.tweetId ?? null,
      tweetUrl: r.tweetUrl ?? null,
      postedAt: r.postedAt.toISOString(),
      status: r.status,
      errorMessage: r.errorMessage ?? null,
    })),
  });
});

export default router;
