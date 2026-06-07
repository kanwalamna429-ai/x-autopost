#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing pnpm"
npm install -g pnpm

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Building shared libs"
pnpm run typecheck:libs

echo "==> Building React frontend"
pnpm --filter @workspace/auto-x-poster run build

echo "==> Building API server"
pnpm --filter @workspace/api-server run build

echo "==> Build complete"
