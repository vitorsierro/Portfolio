# Infra — VPS (Hostinger KVM2)

API NestJS + Excalidraw + OpenClaw atrás de **um único login**, com nginx
fazendo forward-auth contra `GET /auth/verify` da própria API.

O site Next.js **não** vive aqui — fica na Vercel, apontando para
`api.vitorsierro.com`.

## Topologia

| Host | Serviço | Autenticação |
|---|---|---|
| `vitorsierro.com` (+ `www`) | Next.js (Vercel) | login do CMS |
| `api.vitorsierro.com` | NestJS + SQLite | própria (JWT / cookie) |
| `draw.vitorsierro.com` | Excalidraw | **forward-auth do nginx** |
| `claw.vitorsierro.com` | OpenClaw | **forward-auth do nginx** |

Só o nginx publica portas. Os demais serviços existem apenas na rede interna
do Docker — não há como acessar as ferramentas por fora, driblando o gate.

### Por que o login único funciona

Tudo vive sob o mesmo domínio registrável, então o cookie `admin_session`
(escopo `.vitorsierro.com`) é **same-site** — vale entre Vercel e VPS com
`SameSite=Lax`, sem cair nas restrições de cookie de terceiros.

## Setup inicial

### 1. DNS
Registros `A` apontando para o IP da VPS:

```
api    A   <IP-DA-VPS>
draw   A   <IP-DA-VPS>
claw   A   <IP-DA-VPS>
```

O apex e o `www` continuam apontando para a Vercel.

### 2. Hardening da VPS

```bash
adduser deploy && usermod -aG sudo,docker deploy
# authorized_keys para o usuário deploy, então:
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

ufw default deny incoming && ufw default allow outgoing
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable

apt install -y fail2ban unattended-upgrades
```

### 3. Código e segredos

Requer Docker Compose **2.24+** (o `env_file` opcional do OpenClaw usa a
sintaxe `required: false`). Confira com `docker compose version`.

```bash
git clone <repo> /opt/portfolio && cd /opt/portfolio
cp infra/.env.example infra/.env
cp infra/openclaw.env.example infra/openclaw.env   # opcional
openssl rand -base64 48   # gere um para cada JWT_*_SECRET
$EDITOR infra/.env
chmod 600 infra/.env
chmod +x infra/deploy.sh infra/backup-db.sh
```

### 4. Certificados (antes do primeiro `up`)

O nginx não sobe sem os certificados existirem. Emita-os primeiro com o
certbot standalone:

```bash
docker run --rm -p 80:80 \
  -v portfolio_certbot_conf:/etc/letsencrypt \
  certbot/certbot certonly --standalone --agree-tos --no-eff-email \
  -m seu@email.com \
  -d api.vitorsierro.com -d draw.vitorsierro.com -d claw.vitorsierro.com
```

Confirme o nome real do volume com `docker volume ls` (o Compose prefixa com o
nome do diretório do projeto). Depois disso, o container `certbot` do Compose
cuida da renovação sozinho.

### 5. Subir

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.yml --env-file infra/.env \
  exec api npx prisma db seed      # cria o admin (uma vez só)
```

### 6. Vercel

Variáveis de ambiente do projeto web:

```
API_URL=https://api.vitorsierro.com
NEXT_PUBLIC_API_URL=https://api.vitorsierro.com
NEXT_PUBLIC_DRAW_URL=https://draw.vitorsierro.com
NEXT_PUBLIC_CLAW_URL=https://claw.vitorsierro.com
```

Redeploy em seguida.

### 7. Backup no cron

```bash
crontab -e
# 0 3 * * * /opt/portfolio/infra/backup-db.sh >> /var/log/portfolio-backup.log 2>&1
```

⚠️ O `backup-db.sh` grava **no mesmo disco** da VPS. Configure uma cópia
off-site (rclone/S3/Backblaze) no ponto marcado no script — até lá, o disco é
um ponto único de falha.

## Operação

```bash
./infra/deploy.sh                     # pull + rebuild + restart (com backup antes)
docker compose -f infra/docker-compose.yml --env-file infra/.env logs -f api
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
```

## Verificação

```bash
# 401 sem sessão
curl -sI https://api.vitorsierro.com/auth/verify | head -1

# navegação deslogada em draw. redireciona para o login
curl -sI -H 'Sec-Fetch-Mode: navigate' https://draw.vitorsierro.com/ | head -3

# XHR deslogado recebe 401 puro, não HTML de login
curl -sI https://draw.vitorsierro.com/ | head -1

# mutação do CMS exige bearer — só cookie deve dar 401 (proteção anti-CSRF)
curl -sI -X POST https://api.vitorsierro.com/posts --cookie 'admin_session=x' | head -1
```

No navegador: acesse `draw.vitorsierro.com` deslogado → deve cair em
`vitorsierro.com/admin/login?next=...` → após o login, voltar ao Excalidraw.

## Pendências

**OpenClaw** — a imagem em `OPENCLAW_IMAGE` é um palpite razoável; confirme o
nome publicado no repositório oficial. As credenciais de provedor de IA e os
tokens de canal vão em `infra/openclaw.env` (git-ignored, opcional).

**Excalidraw colaborativo** — a imagem pública embute a URL do servidor de WS
em tempo de build. O `excalidraw-room` está no Compose e roteado, mas a
colaboração ao vivo só engata se você buildar o frontend com
`VITE_APP_WS_SERVER_URL`. Desenho individual funciona sem isso.
