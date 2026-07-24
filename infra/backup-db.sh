#!/usr/bin/env bash
# Consistent SQLite backup + pruning. Safe to run while the API is serving:
# `.backup` takes a proper snapshot, unlike `cp` which can capture a torn file
# mid-write.
#
# Install as a daily cron job:
#   0 3 * * * /opt/portfolio/infra/backup-db.sh >> /var/log/portfolio-backup.log 2>&1
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f ${REPO_DIR}/infra/docker-compose.yml --env-file ${REPO_DIR}/infra/.env"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/portfolio}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# sqlite3 is installed in the api image; run the snapshot inside the container
# where /data lives, then copy the result out.
$COMPOSE exec -T api sh -c \
  "sqlite3 /data/prod.db \".backup '/data/backup-${STAMP}.db'\""
$COMPOSE cp "api:/data/backup-${STAMP}.db" "${BACKUP_DIR}/prod-${STAMP}.db"
$COMPOSE exec -T api rm -f "/data/backup-${STAMP}.db"

gzip -f "${BACKUP_DIR}/prod-${STAMP}.db"
echo "Backup written: ${BACKUP_DIR}/prod-${STAMP}.db.gz"

# A backup that only lives on the same disk as the database is not a backup.
# Wire an off-site copy here (rclone/S3/Backblaze) once you have somewhere to
# put it — the VPS disk is a single point of failure until you do.

find "$BACKUP_DIR" -name 'prod-*.db.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "Pruned backups older than ${RETENTION_DAYS} days"
