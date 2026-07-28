#!/usr/bin/env bash
# Snapshot consistente do SQLite.
#
# Usa um container efêmero montando o VOLUME, em vez de rodar dentro do
# container da API. Isso importa porque o deploy chama este script antes de
# tudo: se dependesse da API estar de pé, um deploy que existe justamente para
# consertar a API abortaria no backup e nunca chegaria a corrigir nada.
#
# `.backup` do sqlite3 (e não `cp`) porque copiar o arquivo enquanto há escrita
# pode capturar um estado inconsistente.
#
# Como cron diário:
#   0 3 * * * /opt/portfolio/infra/backup-db.sh >> /var/log/portfolio-backup.log 2>&1
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# O Compose nomeia os volumes com o diretório do arquivo compose — aqui,
# "infra". Sobrescreva com DATA_VOLUME se mudar a estrutura.
DATA_VOLUME="${DATA_VOLUME:-infra_api_data}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/portfolio}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DESTINO="${BACKUP_DIR}/prod-${STAMP}.db"

mkdir -p "$BACKUP_DIR"

if ! docker volume inspect "$DATA_VOLUME" >/dev/null 2>&1; then
  echo "Volume ${DATA_VOLUME} ainda não existe — nada a fazer (primeiro deploy)."
  exit 0
fi

# Banco ainda não criado: primeiro deploy, não há o que preservar.
if ! docker run --rm -v "${DATA_VOLUME}:/data" alpine test -f /data/prod.db 2>/dev/null; then
  echo "Sem /data/prod.db ainda — pulando o backup."
  exit 0
fi

# A imagem alpine já foi baixada; instalar o sqlite aqui evita depender da
# imagem da API, que pode estar quebrada exatamente quando o backup é preciso.
docker run --rm \
  -v "${DATA_VOLUME}:/data" \
  -v "${BACKUP_DIR}:/backup" \
  alpine sh -c "apk add --no-cache sqlite >/dev/null 2>&1 && \
                sqlite3 /data/prod.db \".backup '/backup/prod-${STAMP}.db'\""

gzip -f "$DESTINO"
echo "Backup gravado: ${DESTINO}.gz"

# ATENÇÃO: isto grava no MESMO disco do banco. Um backup que morre junto com o
# servidor não é backup. Configure a cópia off-site (rclone/S3/Backblaze) aqui.

find "$BACKUP_DIR" -name 'prod-*.db.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "Removidos backups com mais de ${RETENTION_DAYS} dias"
