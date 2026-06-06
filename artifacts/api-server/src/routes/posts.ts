import { Router, type IRouter } from "express";
import { db, postsTable, campaignsTable, urlsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/posts", async (req, res): Promise<void> => {
  const rows = await db
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
    .orderBy(postsTable.postedAt);

  const result = rows.map((r) => ({
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
  }));

  // Most recent first
  result.reverse();

  res.json(result);
});

export default router;
