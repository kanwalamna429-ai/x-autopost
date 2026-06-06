import { db, campaignsTable, urlsTable, postsTable, xAccountTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";
import { postTweet, refreshAccessToken } from "./x-client";

async function getValidToken(): Promise<string | null> {
  const [account] = await db.select().from(xAccountTable).limit(1);
  if (!account) return null;

  const now = new Date();
  const expiresAt = account.tokenExpiresAt;
  const needsRefresh = expiresAt && expiresAt <= new Date(now.getTime() + 5 * 60 * 1000);

  if (needsRefresh && account.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(account.refreshToken);
      const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000);
      await db.update(xAccountTable)
        .set({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? account.refreshToken,
          tokenExpiresAt: newExpiry,
        })
        .where(eq(xAccountTable.id, account.id));
      return refreshed.accessToken;
    } catch (err) {
      logger.error({ err }, "Failed to refresh X token");
      return null;
    }
  }

  return account.accessToken;
}

export async function postForCampaign(campaignId: number): Promise<{ success: boolean; message: string; tweetUrl?: string }> {
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) return { success: false, message: "Campaign not found" };
  if (campaign.status !== "active") return { success: false, message: "Campaign is paused" };

  // Find next URL to post
  let urlQuery = db.select().from(urlsTable).where(
    and(
      eq(urlsTable.campaignId, campaignId),
      eq(urlsTable.posted, false),
      eq(urlsTable.failed, false)
    )
  );

  let candidateUrls = await urlQuery;

  // Recycle: if all posted and recycle is enabled, reset all
  if (candidateUrls.length === 0 && campaign.recycleEnabled) {
    await db.update(urlsTable)
      .set({ posted: false, postedAt: null, failed: false, failReason: null })
      .where(eq(urlsTable.campaignId, campaignId));
    candidateUrls = await db.select().from(urlsTable).where(
      and(eq(urlsTable.campaignId, campaignId), eq(urlsTable.posted, false))
    );
  }

  if (candidateUrls.length === 0) {
    return { success: false, message: "No URLs available to post" };
  }

  let selectedUrl = candidateUrls[0];
  if (campaign.postingMode === "random") {
    selectedUrl = candidateUrls[Math.floor(Math.random() * candidateUrls.length)];
  }

  const token = await getValidToken();
  if (!token) {
    return { success: false, message: "No connected X account or token expired" };
  }

  // Build tweet text
  let tweetText = "";
  if (selectedUrl.title) {
    tweetText += selectedUrl.title + "\n\n";
  }
  tweetText += selectedUrl.url;

  if (campaign.addHashtags) {
    tweetText += "\n\n#blog #content";
  }

  if (campaign.ctaText) {
    tweetText += "\n\n" + campaign.ctaText;
  }

  // X limit is 280 chars — truncate title if needed
  if (tweetText.length > 280) {
    const urlPart = "\n\n" + selectedUrl.url;
    const maxTitle = 280 - urlPart.length - 3;
    const title = selectedUrl.title ?? "";
    tweetText = title.substring(0, maxTitle) + "..." + urlPart;
  }

  try {
    const { tweetId, tweetUrl } = await postTweet(token, tweetText);

    // Mark URL as posted
    await db.update(urlsTable)
      .set({ posted: true, postedAt: new Date() })
      .where(eq(urlsTable.id, selectedUrl.id));

    // Record post
    await db.insert(postsTable).values({
      campaignId: campaign.id,
      urlId: selectedUrl.id,
      tweetId,
      tweetUrl,
      postedAt: new Date(),
      status: "success",
    });

    // Update campaign last/next post times
    const nextPostAt = new Date(Date.now() + campaign.frequencyHours * 60 * 60 * 1000);
    await db.update(campaignsTable)
      .set({ lastPostedAt: new Date(), nextPostAt })
      .where(eq(campaignsTable.id, campaign.id));

    logger.info({ campaignId, tweetId, tweetUrl }, "Tweet posted successfully");
    return { success: true, message: "Tweet posted successfully", tweetUrl };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Mark URL as failed
    await db.update(urlsTable)
      .set({ failed: true, failReason: errorMessage })
      .where(eq(urlsTable.id, selectedUrl.id));

    // Record failed post
    await db.insert(postsTable).values({
      campaignId: campaign.id,
      urlId: selectedUrl.id,
      postedAt: new Date(),
      status: "failed",
      errorMessage,
    });

    logger.error({ err, campaignId }, "Failed to post tweet");
    return { success: false, message: errorMessage };
  }
}

export async function runScheduler(): Promise<void> {
  const now = new Date();
  const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.status, "active"));

  for (const campaign of campaigns) {
    const isDue = !campaign.nextPostAt || campaign.nextPostAt <= now;
    if (!isDue) continue;

    logger.info({ campaignId: campaign.id, name: campaign.name }, "Scheduler: posting for campaign");
    await postForCampaign(campaign.id);
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (schedulerInterval) return;
  // Check every 5 minutes
  schedulerInterval = setInterval(() => {
    runScheduler().catch((err) => logger.error({ err }, "Scheduler error"));
  }, 5 * 60 * 1000);

  // Run immediately on startup too
  runScheduler().catch((err) => logger.error({ err }, "Initial scheduler run error"));
  logger.info("Scheduler started");
}
