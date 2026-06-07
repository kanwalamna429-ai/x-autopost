#!/usr/bin/env bash
set -euo pipefail

echo "==> Node $(node --version), npm $(npm --version)"

echo "==> Enabling corepack and installing pnpm"
corepack enable
corepack prepare pnpm@10.26.1 --activate

echo "==> Installing dependencies"
pnpm install --no-frozen-lockfile

echo "==> Building shared libs"
pnpm run typecheck:libs

echo "==> Building React frontend"
pnpm --filter @workspace/auto-x-poster run build

echo "==> Building API server"
pnpm --filter @workspace/api-server run build

echo "==> Build complete"
