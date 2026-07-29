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

# O OpenClaw não tem flag de linha de comando para origens permitidas — conferido
# em `gateway --help`, a lista só existe no arquivo de config dentro do volume.
# O default que ele semeia é loopback (http://localhost:18789), então atrás do
# proxy o browser manda Origin: https://claw..., que não está na lista, e o
# gateway fecha o WebSocket com code=1008 "origin not allowed". A Control UI
# reconecta em loop e o sintoma que aparece é a página "recarregando sozinha" —
# nada que pareça um problema de origem.
#
# Como isso mora num volume, um recreate do openclaw_data traz o bug de volta
# meses depois, quando ninguém lembra do diagnóstico. Por isso é reaplicado aqui.
CLAW_ORIGIN="${CLAW_ORIGIN:-https://claw.vitorsierro.com}"
echo "==> Conferindo a origem permitida do OpenClaw"
origens_atuais="$($COMPOSE exec -T openclaw node openclaw.mjs config get \
  gateway.controlUi.allowedOrigins 2>/dev/null || true)"
# `config get` devolve JSON: um array com as origens entre aspas. Casar com as
# aspas incluídas evita que um prefixo (https://claw.vitorsierro.com.evil.com)
# seja lido como se a origem certa já estivesse configurada.
case "$origens_atuais" in
  *"\"$CLAW_ORIGIN\""*)
    echo "    ok: ${CLAW_ORIGIN} já está permitida"
    ;;
  *)
    echo "    faltando ${CLAW_ORIGIN} — aplicando"
    # `config patch` faz merge recursivo e substitui arrays: é idempotente.
    if printf '{"gateway":{"controlUi":{"allowedOrigins":["%s"]}}}' "$CLAW_ORIGIN" |
       $COMPOSE exec -T openclaw node openclaw.mjs config patch --stdin; then
      # O gateway lê a lista no boot; sem restart o patch não tem efeito.
      $COMPOSE restart openclaw >/dev/null
      echo "    aplicado e openclaw reiniciado"
    else
      # Não aborta o deploy: a API e o Excalidraw estão saudáveis, e derrubar
      # tudo por causa da Control UI seria pior. Mas precisa gritar.
      echo "AVISO: não consegui aplicar allowedOrigins no OpenClaw." >&2
      echo "       A Control UI provavelmente vai ficar recarregando sozinha." >&2
    fi
    ;;
esac

echo "==> Limpando imagens órfãs"
docker image prune -f >/dev/null

echo "==> Status"
$COMPOSE ps
echo ""
echo "Deploy concluído: $(git rev-parse --short HEAD)"
