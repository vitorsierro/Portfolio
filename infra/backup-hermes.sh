#!/usr/bin/env bash
# Snapshot consistente antes de uma atualização que possa migrar dados do agente.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "${REPO_DIR}/infra/docker-compose.yml" --env-file "${REPO_DIR}/infra/.env")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/portfolio}"
STAMP="$(date +%Y%m%d-%H%M%S)"
docker volume inspect infra_hermes_data >/dev/null 2>&1 || exit 0
# Não pausar um agente nem repetir snapshots de vários GB em deploys só da API.
TARGET_IMAGE="$("${COMPOSE[@]}" config --images hermes)"
TARGET_CONTENT="$(docker image inspect "$TARGET_IMAGE" --format '{{json .RootFS}} {{json .Config}}')"
CURRENT_ID="$(docker inspect infra-hermes-1 --format '{{.Image}}' 2>/dev/null || true)"
CURRENT_CONTENT="$(docker image inspect "$CURRENT_ID" --format '{{json .RootFS}} {{json .Config}}' 2>/dev/null || true)"
# BuildKit renova o digest de provenance até em builds 100% em cache.
# Comparar filesystem/configuração evita confundir metadata com migração.
if [ -n "$CURRENT_CONTENT" ] && [ "$TARGET_CONTENT" = "$CURRENT_CONTENT" ]; then
  echo "Imagem do Hermes inalterada — snapshot anterior preservado."
  exit 0
fi
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
  sh -c 'umask 077; tar -czf "/backup/hermes-$1.tar.gz.partial" -C /source . && chown 1000:1000 "/backup/hermes-$1.tar.gz.partial" && mv "/backup/hermes-$1.tar.gz.partial" "/backup/hermes-$1.tar.gz"' sh "$STAMP"
echo "Snapshot do Hermes: ${BACKUP_DIR}/hermes-${STAMP}.tar.gz"
# Reter as duas últimas cópias completas; nunca remover uma cópia parcial
# nem outro tipo de backup. Os nomes incluem data em ordem lexicográfica.
mapfile -t SNAPSHOTS < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hermes-*.tar.gz' -printf '%f\n' | sort -r)
for ((index=2; index<${#SNAPSHOTS[@]}; index++)); do
  snapshot="${SNAPSHOTS[index]}"
  if [[ "$snapshot" =~ ^hermes-[0-9]{8}-[0-9]{6}\.tar\.gz$ ]]; then
    rm -- "${BACKUP_DIR}/${snapshot}"
  fi
done
