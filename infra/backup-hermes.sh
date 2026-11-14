#!/usr/bin/env bash
# Snapshot consistente antes de uma atualização que possa migrar dados do agente.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "${REPO_DIR}/infra/docker-compose.yml" --env-file "${REPO_DIR}/infra/.env")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/portfolio}"
STAMP="$(date +%Y%m%d-%H%M%S)"
docker volume inspect infra_hermes_data >/dev/null 2>&1 || exit 0
mkdir -p "$BACKUP_DIR"
docker pull alpine:3.24 >/dev/null
mapfile -t RUNNING < <("${COMPOSE[@]}" ps --services --filter status=running | grep -E '^(hermes|hermes-proxy)$' || true)
restore_services() {
  if [ "${#RUNNING[@]}" -gt 0 ]; then "${COMPOSE[@]}" start "${RUNNING[@]}"; fi
}
trap restore_services EXIT
if [ "${#RUNNING[@]}" -gt 0 ]; then "${COMPOSE[@]}" stop "${RUNNING[@]}"; fi
docker run --rm --network none \
  -v infra_hermes_data:/source:ro -v "${BACKUP_DIR}:/backup" alpine:3.24 \
  sh -c 'umask 077; tar -czf "/backup/hermes-$1.tar.gz" -C /source . && chown 1000:1000 "/backup/hermes-$1.tar.gz"' sh "$STAMP"
echo "Snapshot do Hermes: ${BACKUP_DIR}/hermes-${STAMP}.tar.gz"
