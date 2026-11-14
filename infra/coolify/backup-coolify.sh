#!/usr/bin/env bash
# Backup diário do painel, SSH do Coolify e segredos locais, com permissão restrita.
set -euo pipefail
umask 077
backup=/var/backups/portfolio/coolify
mkdir -p "$backup"
stamp=$(date +%Y%m%d-%H%M%S)
docker exec coolify-db pg_dump -U coolify -d coolify -Fc > "$backup/database-$stamp.dump.partial"
mv "$backup/database-$stamp.dump.partial" "$backup/database-$stamp.dump"
tar --exclude='data/coolify/ssh/mux' -I 'gzip -1' -cf "$backup/config-$stamp.tar.gz.partial" -C / \
 data/coolify/source data/coolify/ssh data/coolify/applications \
 root/coolify-migration/updater.json opt/portfolio/infra/.env \
 opt/portfolio/infra/hermes.env opt/portfolio/infra/ai-memory.env
mv "$backup/config-$stamp.tar.gz.partial" "$backup/config-$stamp.tar.gz"
find "$backup" -maxdepth 1 -type f \( -name 'database-*.dump' -o -name 'config-*.tar.gz' \) -mtime +14 -delete
printf 'Backup do Coolify concluído: %s\n' "$stamp"