# Auto X Poster

A personal tool that automatically posts blog articles to X (Twitter) on a schedule. Manage campaigns, bulk-add URLs, auto-extract article content, and track post history — all behind a password-protected dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/auto-x-poster run dev` — run the frontend (port 20551)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter
- API: Express 5 + express-session
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions (campaigns, urls, posts, x_account)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/scheduler.ts` — posting scheduler (runs every 5 min)
- `artifacts/api-server/src/lib/x-client.ts` — X OAuth 2.0 + tweet posting
- `artifacts/api-server/src/lib/content-extractor.ts` — Open Graph scraper
- `artifacts/auto-x-poster/src/pages/` — React pages (dashboard, campaigns, settings, etc.)

## Architecture decisions

- Session-based auth (express-session) with a single `DASHBOARD_PASSWORD` env var — no user DB
- X OAuth 2.0 with PKCE flow; tokens stored in DB; auto-refresh on expiry
- Scheduler polls every 5 minutes; checks `next_post_at` per campaign
- Content extraction is fire-and-forget on URL add (async, updates DB after response)
- Single X account supported (personal tool); connecting replaces the existing account

## Product

- Login with a dashboard password
- Create unlimited campaigns with flexible posting schedules (1h–24h or custom)
- Add up to 500 URLs per campaign (bulk paste, auto-dedup)
- Auto-extracts page title, image, and description via Open Graph
- Sequential or random posting modes with optional recycle
- Connect X account via OAuth 2.0 — test/disconnect anytime
- Dashboard stats: campaigns, URLs, posts today, posts all-time
- Full post history with tweet links

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After schema changes: `pnpm --filter @workspace/db run push` then `pnpm run typecheck:libs`
- After OpenAPI spec changes: `pnpm --filter @workspace/api-spec run codegen` before touching routes
- `credentials: "include"` is set globally in `lib/api-client-react/src/custom-fetch.ts` so cookies work through the proxy
- X OAuth callback URL must be registered in the X developer dashboard as: `https://<your-domain>/api/x-account/callback`
- `SESSION_SECRET` env var is already set; used for express-session signing

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
