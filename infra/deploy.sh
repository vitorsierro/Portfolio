#!/usr/bin/env bash
# Pull the latest code and restart the stack. Run from anywhere on the VPS.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f ${REPO_DIR}/infra/docker-compose.yml --env-file ${REPO_DIR}/infra/.env"

cd "$REPO_DIR"

echo "==> Backing up the database before deploying"
"${REPO_DIR}/infra/backup-db.sh"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Rebuilding and restarting"
# Migrations run in the api container's start command (prisma migrate deploy).
$COMPOSE up -d --build

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Status"
$COMPOSE ps
