#!/usr/bin/env bash
# Provisionamento inicial da VPS. Rode UMA VEZ, como root, numa máquina nova:
#
#   ssh root@SEU_IP
#   curl -fsSL https://raw.githubusercontent.com/vitorsierro/Portfolio/main/infra/provision.sh -o provision.sh
#   bash provision.sh
#
# Idempotente: rodar de novo não quebra nada. Não instala a stack — só prepara
# o servidor e cria o usuário que o deploy vai usar.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
REPO_URL="${REPO_URL:-https://github.com/vitorsierro/Portfolio.git}"
# Enquanto o trabalho não estiver na main, dá para provisionar apontando para
# outra branch:  REPO_BRANCH=reestruturar-arquitetura bash provision.sh
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_DIR="/opt/portfolio"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }
aviso() { printf '\033[1;33m!! %s\033[0m\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root." >&2
  exit 1
fi

log "Atualizando o sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

log "Instalando o básico"
apt-get install -y -qq ca-certificates curl git ufw fail2ban unattended-upgrades sqlite3

log "Instalando Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc 2>/dev/null ||
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "Docker já instalado: $(docker --version)"
fi

# Deploy como root daria ao GitHub Actions poder total sobre a máquina. Um
# usuário dedicado limita o estrago se a chave vazar.
log "Criando o usuário de deploy: $DEPLOY_USER"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

log "Preparando $APP_DIR (branch: $REPO_BRANCH)"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch --all --quiet
  git -C "$APP_DIR" checkout "$REPO_BRANCH" --quiet
  git -C "$APP_DIR" pull --ff-only --quiet
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
chmod +x "$APP_DIR"/infra/*.sh 2>/dev/null || true

# /var/backups pertence ao root, então o backup-db.sh não consegue criar a
# pasta rodando como $DEPLOY_USER — e o deploy.sh aborta de propósito quando o
# backup falha. Rodando o deploy à mão como root isso nunca aparece; o primeiro
# deploy pelo GitHub Actions falha na hora.
log "Criando o diretório de backups"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 /var/backups/portfolio

if [ "$REPO_BRANCH" != "main" ]; then
  aviso "Provisionado a partir de '$REPO_BRANCH'. O deploy automático só"
  aviso "dispara em push na main — faça o merge quando for a hora."
fi

log "Firewall (só 22, 80 e 443)"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status numbered

log "fail2ban e atualizações automáticas"
systemctl enable --now fail2ban >/dev/null 2>&1 || true
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

log "Gerando a chave SSH que o GitHub Actions vai usar"
KEY_PATH="/root/deploy_key_${DEPLOY_USER}"
if [ ! -f "$KEY_PATH" ]; then
  ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f "$KEY_PATH" >/dev/null
  cat "${KEY_PATH}.pub" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

cat <<EOF

==========================================================================
PRÓXIMOS PASSOS (manuais, por segurança)

1. Copie a CHAVE PRIVADA abaixo inteira e salve no GitHub em
   Settings → Secrets and variables → Actions → New repository secret

   Nome: VPS_SSH_KEY

--------------------------------------------------------------------------
$(cat "$KEY_PATH")
--------------------------------------------------------------------------

   Crie também:
     VPS_HOST  = o IP desta VPS
     VPS_USER  = $DEPLOY_USER

2. Preencha os segredos da aplicação:
     cp $APP_DIR/infra/.env.example $APP_DIR/infra/.env
     openssl rand -base64 48   # gere um para cada JWT_*_SECRET
     nano $APP_DIR/infra/.env
     chmod 600 $APP_DIR/infra/.env

3. Emita os certificados ANTES do primeiro 'up' — o nginx não sobe sem eles.
   O comando está em infra/README.md, seção "Certificados".

4. Desative login por senha e como root (faça DEPOIS de testar que
   'ssh $DEPLOY_USER@IP' funciona, senão você se tranca para fora):
     sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
     sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
     systemctl restart ssh

5. Apague a chave privada deste servidor depois de salvá-la no GitHub:
     rm $KEY_PATH
==========================================================================

EOF

aviso "A chave privada acima ainda está em $KEY_PATH — apague após copiar."
