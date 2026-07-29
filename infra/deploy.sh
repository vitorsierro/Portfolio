#!/usr/bin/env bash
# Atualiza o código e reinicia a stack. Rode de qualquer lugar na VPS.
#
# Também é o que o GitHub Actions executa em cada push na main — por isso
# precisa falhar alto quando algo dá errado, em vez de sair 0 com o serviço
# fora do ar.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f ${REPO_DIR}/infra/docker-compose.yml --env-file ${REPO_DIR}/infra/.env"

cd "$REPO_DIR"

if [ ! -f "${REPO_DIR}/infra/.env" ]; then
  echo "ERRO: infra/.env não existe. Copie de infra/.env.example e preencha." >&2
  exit 1
fi

echo "==> Backup do banco antes de mexer"
# Se o backup falhar, PARE: uma migration ruim sem backup é irreversível.
"${REPO_DIR}/infra/backup-db.sh"

# Guarda o commit atual para permitir voltar atrás manualmente.
COMMIT_ANTERIOR="$(git rev-parse --short HEAD)"
echo "==> Commit atual: ${COMMIT_ANTERIOR}"

# Quando chamado pelo Actions o código já veio via reset --hard; aqui o pull
# cobre o uso manual e é inofensivo se já estiver atualizado.
echo "==> Buscando código novo"
git pull --ff-only || echo "    (já atualizado ou repositório em modo detached)"

# A config do nginx entra por bind mount, então o container que está no ar já
# enxerga os arquivos novos ANTES de qualquer restart. Isso permite validar
# enquanto o proxy antigo ainda serve: uma vírgula errada aqui derruba api,
# draw e claw de uma vez, e o healthcheck abaixo não pegaria — ele fala com a
# API pela rede interna, sem passar pelo proxy.
if $COMPOSE ps --services --filter status=running 2>/dev/null | grep -qx nginx; then
  echo "==> Validando a config do nginx (antes de recarregar)"
  if ! $COMPOSE exec -T nginx nginx -t; then
    echo "" >&2
    echo "ERRO: config do nginx inválida. Nada foi reiniciado — o proxy" >&2
    echo "antigo continua no ar. Corrija antes de tentar de novo." >&2
    exit 1
  fi
fi

echo "==> Rebuild e restart"
# As migrations rodam no start do container da API (prisma migrate deploy).
$COMPOSE up -d --build

echo "==> Aguardando a API ficar saudável"
saudavel=0
for tentativa in $(seq 1 20); do
  # Fala com o container pela rede interna: se responder aqui, o problema
  # eventual está no proxy, não na aplicação — separa os dois diagnósticos.
  if $COMPOSE exec -T api node -e "
      fetch('http://127.0.0.1:3001/portfolio')
        .then(r => process.exit(r.ok ? 0 : 1))
        .catch(() => process.exit(1))
    " >/dev/null 2>&1; then
    saudavel=1
    echo "    ok na tentativa ${tentativa}"
    break
  fi
  sleep 3
done

if [ "$saudavel" -ne 1 ]; then
  echo "" >&2
  echo "ERRO: a API não respondeu após o deploy." >&2
  echo "Logs recentes:" >&2
  $COMPOSE logs --tail=40 api >&2
  echo "" >&2
  echo "Para voltar ao commit anterior:" >&2
  echo "  cd ${REPO_DIR} && git reset --hard ${COMMIT_ANTERIOR} && ./infra/deploy.sh" >&2
  exit 1
fi

echo "==> Limpando imagens órfãs"
docker image prune -f >/dev/null

echo "==> Status"
$COMPOSE ps
echo ""
echo "Deploy concluído: $(git rev-parse --short HEAD)"
