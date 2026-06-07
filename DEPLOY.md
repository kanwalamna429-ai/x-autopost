# Deployment Guide — Auto X Poster

This app has two parts that need separate hosting:

| Part | Host | Why |
|------|------|-----|
| React frontend | **Vercel** | Static Vite build |
| Express API + Scheduler | **Render** | Needs a persistent always-on process (the scheduler runs every 5 min) |

---

## Step 1 — Push to GitHub

1. Go to [github.com/new](https://github.com/new) and create a **new empty repository** (no README, no .gitignore).

2. In the Replit Shell, run:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

3. Your **entire monorepo** goes to GitHub. Both Vercel and Render will filter to their specific folder using build commands — you do not need to upload separate folders.

---

## Step 2 — Deploy the API Server to Render

The API handles all `/api/*` routes and runs the posting scheduler.

### 2a. Create a PostgreSQL database on Render

1. Go to [render.com](https://render.com) → **New → PostgreSQL**
2. Name it `auto-x-poster-db`, choose the free plan
3. After creation, copy the **Internal Database URL** (or External if you prefer)

### 2b. Create a Web Service for the API

1. **New → Web Service** → connect your GitHub repo
2. Fill in these settings:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `artifacts/api-server` |
   | **Environment** | Node |
   | **Build Command** | `cd ../.. && npm install -g pnpm && pnpm install --frozen-lockfile && pnpm run typecheck:libs && pnpm --filter @workspace/api-server run build` |
   | **Start Command** | `node --enable-source-maps ./dist/index.mjs` |
   | **Plan** | Free (or Starter for no sleep) |

3. Add these **Environment Variables** in Render:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` *(Render assigns this automatically — leave as is)* |
   | `DATABASE_URL` | *(paste the PostgreSQL Internal URL from Step 2a)* |
   | `DASHBOARD_PASSWORD` | *(your chosen login password)* |
   | `SESSION_SECRET` | *(any long random string, e.g. 64 random hex chars)* |
   | `X_CLIENT_ID` | *(from X Developer Portal)* |
   | `X_CLIENT_SECRET` | *(from X Developer Portal)* |

4. Click **Deploy**. Wait for the build to finish (2–4 minutes).

5. Note your Render API URL — it will look like:
   ```
   https://auto-x-poster-api.onrender.com
   ```

### 2c. Run the database migration

After the first successful deploy, open the Render **Shell** tab and run:
```bash
cd ../..
pnpm --filter @workspace/db run push
```
This creates all the tables in your production Postgres DB.

---

## Step 3 — Deploy the Frontend to Vercel

### 3a. Import the repo into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select your repo
2. Configure the project:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `artifacts/auto-x-poster` |
   | **Framework Preset** | Vite |
   | **Build Command** | `cd ../.. && npm install -g pnpm && pnpm install --frozen-lockfile && pnpm run typecheck:libs && pnpm --filter @workspace/auto-x-poster run build` |
   | **Output Directory** | `dist` |
   | **Install Command** | *(leave blank — handled by build command)* |

3. Add these **Environment Variables** in Vercel:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | `https://auto-x-poster-api.onrender.com` *(your Render URL from Step 2)* |

4. Click **Deploy**.

5. Note your Vercel URL — it will look like:
   ```
   https://auto-x-poster.vercel.app
   ```

---

## Step 4 — Wire the frontend to the API

The frontend needs to know where to send API requests. Open `artifacts/auto-x-poster/vite.config.ts` and make sure the proxy or base URL points to Render in production.

**Easier approach — use a Vercel rewrite rule:**

Create `artifacts/auto-x-poster/vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://auto-x-poster-api.onrender.com/api/:path*"
    }
  ]
}
```

This proxies all `/api/*` calls from your Vercel frontend to your Render backend transparently — no CORS issues, no code changes needed.

Redeploy Vercel after adding this file.

---

## Step 5 — Update X Developer App callback URL

In the [X Developer Portal](https://developer.twitter.com/en/apps):

1. Open your app → **Settings → User authentication settings**
2. Add this callback URL:
   ```
   https://auto-x-poster.vercel.app/api/x-account/callback
   ```
   *(replace with your actual Vercel domain)*
3. Save

---

## Step 6 — Update REPLIT_DOMAINS on Render

The API uses `REPLIT_DOMAINS` to build the OAuth callback URL. In production, replace it with your Vercel domain.

In Render → Environment Variables, add:

| Key | Value |
|-----|-------|
| `REPLIT_DOMAINS` | `auto-x-poster.vercel.app` *(your Vercel domain, no https://)* |

Redeploy the Render service after adding this.

---

## Step 7 — Test the full stack

1. Open your Vercel URL in a browser
2. Log in with your `DASHBOARD_PASSWORD`
3. Go to **Settings → Connect X Account**
4. Complete the Twitter OAuth flow
5. Create a campaign, add URLs, hit **Force Post**

---

## Summary — What lives where

```
GitHub repo (full monorepo)
├── artifacts/auto-x-poster/   ← Vercel deploys this (frontend)
├── artifacts/api-server/      ← Render deploys this (API + scheduler)
├── lib/                       ← shared code (built during CI)
└── ...
```

## Free tier caveats

- **Render free tier** spins down after 15 minutes of inactivity. The scheduler will miss posts while sleeping. Upgrade to **Starter ($7/mo)** to keep it always on.
- **Vercel free tier** is more than enough for the frontend.
