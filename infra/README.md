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

### 0. Provisionamento (uma vez, na VPS nova)

```bash
ssh root@SEU_IP
curl -fsSL https://raw.githubusercontent.com/vitorsierro/Portfolio/main/infra/provision.sh -o provision.sh
bash provision.sh
```

Instala Docker, cria o usuário `deploy` (o GitHub Actions **não** usa root),
liga `ufw`/`fail2ban`, clona o repositório em `/opt/portfolio` e gera a chave
SSH do deploy. No fim ele imprime a chave privada e os próximos passos.

⚠️ **Só desative o login por senha depois de confirmar que
`ssh deploy@SEU_IP` funciona** — na ordem inversa você se tranca para fora.

### Deploy automático

Um push na `main` que toque em `apps/api/**` ou `infra/**` dispara
`.github/workflows/deploy.yml`, que: roda lint e testes, conecta por SSH,
executa `infra/deploy.sh` (backup → pull → rebuild → healthcheck) e depois
confirma pela internet que a API respondeu **e** que o contrato de auth
continua valendo.

Segredos necessários no GitHub (*Settings → Secrets and variables → Actions*):

| Segredo | Valor |
|---|---|
| `VPS_HOST` | IP da VPS |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | chave privada gerada pelo `provision.sh` |
| `API_HOST` | `api.vitorsierro.com` |
| `WEB_HOST` | `vitorsierro.com` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | opcionais — habilitam o contrato de auth pós-deploy |

Se o healthcheck falhar, o deploy falha e o log mostra o comando exato para
voltar ao commit anterior. **Não há rollback automático**: reverter um deploy
que já rodou migration pode perder dados, então essa decisão fica com você.

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

## Raio de alcance do OpenClaw

O OpenClaw é o único serviço aqui que executa comandos e processa entrada não
confiável (mensagens, páginas web). Se ele for comprometido ou "enlouquecer",
o que ele consegue atingir:

**Não consegue:**
- Apagar o banco — o volume `api_data` (onde vive o `prod.db`) não é montado
  nele. Só enxerga o próprio `/home/node/.openclaw`.
- Controlar containers — sem acesso ao socket do Docker.
- Virar root no host — roda como uid 1000, sem `privileged` e sem
  capabilities extras.
- Falar com a API ou o Excalidraw pela rede interna — cada zona tem sua
  própria rede e ele está sozinho na `claw`.

**Consegue:**
- Destruir os próprios dados (config, credenciais de provedor, memória).
- Sair para a internet — é o que ele precisa para chamar as APIs de IA. Por
  aí ele também alcança `api.vitorsierro.com` pela via pública, mas então
  passa pelo nginx e cai no rate limit do `/auth/login`, como qualquer um.
- Se alguém obtiver o login do admin, aí sim é possível apagar posts via API
  — mas isso vale para qualquer atacante com a senha, não é específico dele.

A segmentação de rede é o que fecha o caminho mais perigoso: sem ela, o
OpenClaw falaria direto com `api:3001` e poderia tentar senhas à vontade,
já que o `limit_req` mora no nginx e uma chamada interna o contorna.

## Operação

```bash
./infra/deploy.sh                     # pull + rebuild + restart (com backup antes)
docker compose -f infra/docker-compose.yml --env-file infra/.env logs -f api
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
```

## Testar localmente (antes de ter a VPS)

### Sem Docker — valida toda a lógica de auth

```bash
yarn workspace api prisma:migrate && yarn workspace api prisma:seed
yarn dev                       # web:3000 + api:3001
```

Com a API no ar, rode o contrato de segurança:

```bash
bash infra/verify-auth.sh http://localhost:3001 <email-do-admin> '<senha>'
```

São 12 asserções: rotas públicas x protegidas, o contrato 204/401 do
`/auth/verify`, revogação no logout, bloqueio de origem, e o invariante
anti-CSRF (cookie sozinho nunca autoriza mutação). Tudo deve passar.

No navegador: `/blog`, `/blog/post/<slug>`, e `/admin` (login → hub → CMS).
Os cards das ferramentas só aparecem se `NEXT_PUBLIC_DRAW_URL`/`_CLAW_URL`
estiverem preenchidos.

**O que isso não cobre:** o forward-auth do nginx. Sem nginx, nada exercita
`auth_request`, o redirect condicional nem os certificados.

### Rodar as ferramentas no localhost

Aponte o web para as portas locais em `apps/web/.env.local` (e **reinicie o
`yarn dev`** — o Next só lê env na inicialização):

```
NEXT_PUBLIC_DRAW_URL="http://localhost:8080"
NEXT_PUBLIC_CLAW_URL="http://localhost:18789"
```

**Com Docker** (um comando, sobe as duas):

```bash
docker compose -f infra/docker-compose.local.yml up -d
```

**Sem Docker:**

- *OpenClaw* exige Node `>=22.22.3 <23`, `>=24.15 <25` ou `>=25.9`. Com nvm:
  `nvm install 24.15.0 && nvm use 24.15.0`, depois
  `npm i -g openclaw@latest` e `openclaw gateway --port 18789`.
- *Excalidraw* não tem pacote standalone no npm (o `excalidraw` do registry é
  só um componente para embutir). Sem Docker, é clonar
  `github.com/excalidraw/excalidraw` e rodar o dev server dele numa porta
  livre — ou usar `excalidraw.com` enquanto isso.

**O OpenClaw exige token — não é opcional.** Ele se recusa a escutar fora do
loopback sem autenticação, e em container o bind é sempre `0.0.0.0`. Sem token
o container entra em loop de restart com `Missing config`. Gere um em
`infra/openclaw.env`:

```bash
node -e "console.log('OPENCLAW_GATEWAY_TOKEN='+require('crypto').randomBytes(32).toString('base64url'))" >> infra/openclaw.env
```

Para abrir a Control UI, o token vai no **fragmento** da URL (não query
string — assim não trafega ao servidor nem entra em log):

```
http://localhost:18789/#token=<SEU_TOKEN>
```

Ou cole o token no campo "Token do Gateway" na própria tela. `docker compose
-f infra/docker-compose.local.yml exec openclaw node openclaw.mjs dashboard
--no-open` imprime a URL.

**O OpenClaw recusa a Control UI quando ela vem de outra origem.** Servido
atrás do proxy, a origem deixa de ser a dele (`:18789`) e ele fecha o
WebSocket com `origin not allowed` — a tela fica presa no login mesmo com o
token certo. Libere a origem uma vez (fica no volume, sobrevive a restart):

```bash
echo '{ gateway: { controlUi: { allowedOrigins: ["http://localhost:8082"] } } }' \
  | docker compose -f infra/docker-compose.dev.yml exec -T openclaw \
    node openclaw.mjs config patch --stdin
docker compose -f infra/docker-compose.dev.yml restart openclaw
```

Em produção o valor é `https://claw.vitorsierro.com` — sem isso o OpenClaw
não abre pelo domínio, por mais que o gate do nginx deixe passar.

⚠️ Rodando assim **não existe barreira de login** do nosso lado: sem nginx,
nada faz o forward-auth. Serve para desenvolver a integração do `/admin`, não
para validar o gate. (A porta fica presa a `127.0.0.1` no host, então ao menos
não está exposta na LAN.)

### Ensaio do forward-auth (recomendado) — barreira de login de verdade

`docker-compose.local.yml` publica as ferramentas direto, **sem autenticação**.
Para exercitar o mesmo gate da produção, use o `dev`, onde elas ficam atrás do
nginx e **não publicam portas**:

```bash
yarn dev                                              # a API em :3001 valida a sessão
docker compose -f infra/docker-compose.dev.yml up -d
```

- `http://localhost:8081` → Excalidraw (exige login)
- `http://localhost:8082` → OpenClaw (exige login)

Com `apps/web/.env.local` apontando para essas portas, o `/admin` já usa a
versão protegida. Sem sessão, uma navegação cai em
`/admin/login?next=…`; um XHR recebe 401 puro.

Aqui as portas são separadas por número em vez de subdomínio, para não exigir
mexer no `hosts` do Windows. Cookies **ignoram porta**, então o `admin_session`
de `localhost:3001` vale para `localhost:8081` — é isso que faz o login único
funcionar neste ensaio.

**Armadilha:** `host.docker.internal` resolve para IPv4 **e** IPv6, e só o IPv4
é roteável. Sem `resolver ... ipv6=off` o nginx alterna entre os dois e metade
das requisições morre com 500 (o HTML carrega, os assets falham). Por isso o
`proxy_pass` do bloco de auth usa variável — é o que força a resolução pelo
resolver.

### Com Docker — ensaio do forward-auth

Para exercitar o gate de verdade antes da VPS, use domínios `.test` apontando
para o loopback. No Windows, como administrador, adicione em
`C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 api.vitorsierro.test draw.vitorsierro.test claw.vitorsierro.test
```

Então suba a stack com `SESSION_COOKIE_DOMAIN=".vitorsierro.test"` e
`WEB_ORIGIN="http://localhost:3000"`. Como não há TLS local, ajuste os
`server` blocks para `listen 80` sem `ssl` numa cópia de `conf.d/` — a
estrutura de `auth_request` é idêntica à de produção, que é justamente o que
você quer ensaiar.

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

**OpenClaw com login realmente único (`trusted-proxy`)** — hoje o gateway usa
`--auth token`, então, mesmo passando pelo gate do nginx, a Control UI ainda
pede o token uma vez. O OpenClaw suporta `auth.mode = "trusted-proxy"`, que
delega a autenticação ao proxy e elimina esse passo. Exige arquivo de config
(não dá só por flag):

```json5
{
  gateway: {
    bind: "lan",
    trustedProxies: ["<IP do container nginx na rede docker>"],
    auth: {
      mode: "trusted-proxy",
      trustedProxy: {
        userHeader: "x-auth-user",          // já enviado pelo nosso nginx
        requiredHeaders: ["x-forwarded-proto", "x-forwarded-host"],
        allowUsers: ["<email do admin>"],
        allowLoopback: false,
      },
    },
  },
}
```

Cuidados que a doc oficial destaca, e que já valem no nosso desenho:
a porta do gateway **não pode** estar exposta a ninguém além do proxy (o
compose de produção não publica portas — ok); o proxy precisa **sobrescrever**
os headers vindos do cliente (`proxy_set_header X-Auth-User $auth_user`
substitui, não anexa — ok); e o startup é **rejeitado** se um token
compartilhado também estiver configurado, então ao migrar remova
`OPENCLAW_GATEWAY_TOKEN` e o `--auth token`.

Para `allowUsers` ficar legível, convém `/auth/verify` passar a devolver o
e-mail do admin em `X-Auth-User` em vez do `adminId`.

**Imagem** — `ghcr.io/openclaw/openclaw:latest` foi confirmada (baixa e roda).
Credenciais de provedor de IA e tokens de canal vão em `infra/openclaw.env`.

**Excalidraw colaborativo** — a imagem pública embute a URL do servidor de WS
em tempo de build. O `excalidraw-room` está no Compose e roteado, mas a
colaboração ao vivo só engata se você buildar o frontend com
`VITE_APP_WS_SERVER_URL`. Desenho individual funciona sem isso.
