import { Router, type IRouter } from "express";
import { db, xAccountTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { generateOAuthUrl, exchangeCodeForToken, verifyToken } from "../lib/x-client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// In-memory store for OAuth state (state -> { codeVerifier, callbackUrl })
const oauthStateStore = new Map<string, { codeVerifier: string; callbackUrl: string }>();

function getCallbackUrl(req: { headers: { host?: string; "x-forwarded-proto"?: string } }): string {
  const domains = process.env.REPLIT_DOMAINS ?? "";
  if (domains) {
    const firstDomain = domains.split(",")[0].trim();
    return `https://${firstDomain}/api/x-account/callback`;
  }
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers.host ?? "localhost";
  return `${proto}://${host}/api/x-account/callback`;
}

router.get("/x-account", requireAuth, async (req, res): Promise<void> => {
  const [account] = await db.select().from(xAccountTable).limit(1);
  if (!account) {
    res.json({ connected: false, username: null, displayName: null, profileImageUrl: null, connectedAt: null });
    return;
  }
  res.json({
    connected: true,
    username: account.username,
    displayName: account.displayName,
    profileImageUrl: account.profileImageUrl ?? null,
    connectedAt: account.connectedAt.toISOString(),
  });
});

router.delete("/x-account", requireAuth, async (req, res): Promise<void> => {
  await db.delete(xAccountTable);
  res.json({ connected: false, username: null, displayName: null, profileImageUrl: null, connectedAt: null });
});

router.get("/x-account/connect", requireAuth, async (req, res): Promise<void> => {
  const callbackUrl = getCallbackUrl(req);
  const { url, state, codeVerifier } = generateOAuthUrl(callbackUrl);
  oauthStateStore.set(state, { codeVerifier, callbackUrl });

  // Clean up old states after 10 minutes
  setTimeout(() => oauthStateStore.delete(state), 10 * 60 * 1000);

  res.json({ url });
});

router.get("/x-account/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

  const frontendBase = (() => {
    const domains = process.env.REPLIT_DOMAINS ?? "";
    if (domains) return `https://${domains.split(",")[0].trim()}`;
    return "";
  })();

  if (error || !code || !state) {
    logger.warn({ error, code, state }, "X OAuth callback error");
    res.redirect(`${frontendBase}/settings?error=oauth_failed`);
    return;
  }

  const stored = oauthStateStore.get(state);
  if (!stored) {
    res.redirect(`${frontendBase}/settings?error=invalid_state`);
    return;
  }

  oauthStateStore.delete(state);

  try {
    const tokenData = await exchangeCodeForToken(code, stored.codeVerifier, stored.callbackUrl);

    // Delete existing account and insert new one
    await db.delete(xAccountTable);
    await db.insert(xAccountTable).values({
      username: tokenData.username,
      displayName: tokenData.displayName,
      profileImageUrl: tokenData.profileImageUrl ?? null,
      xUserId: tokenData.xUserId,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken ?? null,
      tokenExpiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
      connectedAt: new Date(),
    });

    logger.info({ username: tokenData.username }, "X account connected");
    res.redirect(`${frontendBase}/settings?connected=true`);
  } catch (err) {
    logger.error({ err }, "X OAuth token exchange failed");
    res.redirect(`${frontendBase}/settings?error=token_exchange_failed`);
  }
});

router.post("/x-account/test", requireAuth, async (req, res): Promise<void> => {
  const [account] = await db.select().from(xAccountTable).limit(1);
  if (!account) {
    res.json({ success: false, message: "No X account connected" });
    return;
  }

  try {
    const user = await verifyToken(account.accessToken);
    res.json({ success: true, message: `Connected as @${user.username}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ success: false, message: `Connection test failed: ${msg}` });
  }
});

export default router;
