import crypto from "crypto";
import { logger } from "./logger";

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET!;

const OAUTH_STATE_SECRET = process.env.SESSION_SECRET ?? "fallback-secret";

export function generateOAuthUrl(callbackUrl: string): { url: string; state: string; codeVerifier: string } {
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: X_CLIENT_ID,
    redirect_uri: callbackUrl,
    scope: "tweet.read tweet.write users.read offline.access media.write",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    url: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
    state,
    codeVerifier,
  };
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  callbackUrl: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number; xUserId: string; username: string; displayName: string; profileImageUrl: string | null }> {
  const credentials = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64");

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    logger.error({ err }, "Failed to exchange X OAuth code for token");
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
  };

  // Get user info
  const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userRes.ok) {
    const err = await userRes.text();
    logger.error({ err }, "Failed to fetch X user info");
    throw new Error(`User fetch failed: ${err}`);
  }

  const userData = await userRes.json() as {
    data: { id: string; username: string; name: string; profile_image_url?: string };
  };

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    expiresIn: tokenData.expires_in ?? 7200,
    xUserId: userData.data.id,
    username: userData.data.username,
    displayName: userData.data.name,
    profileImageUrl: userData.data.profile_image_url ?? null,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
  const credentials = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? 7200,
  };
}

export async function postTweet(accessToken: string, text: string): Promise<{ tweetId: string; tweetUrl: string }> {
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error({ err }, "Failed to post tweet");
    throw new Error(`Post tweet failed: ${err}`);
  }

  const data = await res.json() as { data: { id: string; text: string } };
  const tweetId = data.data.id;

  // We need the username to construct the URL — fetch from /2/users/me
  const userRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userData = await userRes.json() as { data: { username: string } };
  const tweetUrl = `https://twitter.com/${userData.data.username}/status/${tweetId}`;

  return { tweetId, tweetUrl };
}

export async function verifyToken(accessToken: string): Promise<{ id: string; username: string; name: string }> {
  const res = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Token verification failed");
  }

  const data = await res.json() as { data: { id: string; username: string; name: string } };
  return data.data;
}
