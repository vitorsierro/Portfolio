# CLAUDE.md

Contexto e armadilhas deste repositório. Leia antes de mexer.

## Como trabalhar aqui

1. **Responda sempre em português.** Vale para tudo: explicações, resumos,
   mensagens de commit e descrições de PR.
2. **Ao terminar uma tarefa, commite e suba numa branch nova a partir da `main`.**
   Nunca empilhe o trabalho novo numa branch de feature antiga — o PR acabaria
   arrastando junto commits que não têm nada a ver com a mudança. O fluxo é
   `git checkout -b <nome> origin/main`, commit, push.

## Estrutura

Monorepo Yarn workspaces:

- `apps/web` — Next.js 15 (App Router), React 19, **CSS Modules** (sem Tailwind). Vai para a **Vercel**.
- `apps/api` — NestJS 11 + Prisma/SQLite. Vai para a **VPS** (Hostinger KVM2).
- `infra/` — docker-compose, nginx, scripts de deploy/backup. Ver `infra/README.md`.

## Comandos

```bash
yarn dev                              # web:3000 + api:3001 juntos
yarn workspace api test               # 28 testes
yarn workspace web test               # 15 testes
yarn workspace api prisma:migrate     # migration + seed
bash infra/verify-auth.sh http://localhost:3001 <email> <senha>   # contrato de auth
```

---

## Armadilhas (custaram tempo — não repetir)

### 1. Nunca rode build de produção com o `yarn dev` no ar
`yarn workspace web build` e `next dev` escrevem no **mesmo `.next`**. Rodar o build
com o dev server ativo corrompe o cache dele (`ENOENT` em
`.next/server/app/**/page.js`) e **limpar o `.next` não resolve** — o processo
mantém estado em memória. A única saída é reiniciar o `yarn dev`.

Antes de subir qualquer servidor, **cheque o que já está rodando** (portas 3000/3001)
em vez de assumir que estão livres.

### 2. `.dockerignore` fica na raiz do repo, não em `apps/api/`
O contexto de build é a raiz (`docker build -f apps/api/Dockerfile .`), então o
Docker lê `./.dockerignore`. Um arquivo em `apps/api/.dockerignore` é **silenciosamente
ignorado** — foi assim que o `dev.db` (com hash da senha do admin) quase foi parar
na imagem de produção.

### 3. Prisma fixado na v6
A v7 exige driver adapters + `prisma.config.ts`, o que complica o SQLite.
Não atualize sem refazer a configuração do client.

### 4. `tsconfig.build.json` precisa excluir `prisma`
Sem `include: ["src/**/*"]` + `exclude: [..., "prisma"]`, o `prisma/seed.ts` puxa o
`rootDir` para cima e o Nest emite em `dist/src/...` em vez de `dist/...`,
quebrando o `node dist/main`.

### 5. Jest quebra com `marked` e `sanitize-html`
Ambos são ESM-only e o Jest roda em CommonJS. Specs que importam a cadeia do
`PostsService` precisam mocká-los (ver `posts.controller.spec.ts`).

### 6. Paginação por cursor: o cursor é o **último item devolvido**
O service busca `limit + 1` (look-ahead). O `nextCursor` deve apontar para o último
item **mantido**, não para a linha extra — senão a página seguinte usa `skip: 1` a
partir da extra e **pula um post**. Há teste de regressão em `posts.service.spec.ts`.

### 7. `refresh()` rotaciona o token, então precisa de dedupe
O StrictMode do Next invoca efeitos duas vezes; dois refreshes concorrentes usariam
o mesmo cookie e o segundo falharia, derrubando a sessão. Por isso `lib/auth.js`
compartilha a promise em voo e as páginas usam `ensureSession()` (só renova quando
não há token em memória).

### 8. `dev.db` e `.env` são git-ignored
Se o login local parar de funcionar, provavelmente falta rodar
`yarn workspace api prisma:migrate && yarn workspace api prisma:seed`.

### 9. Nenhum fetch de página pré-renderizada pode lançar
`/` e `/blog` são gerados no build. Se o fetch lançar, **o build inteiro cai** —
e na CI não existe API nem `.env.local`, então o cenário normal é a API estar
ausente, não no ar.

O detalhe que engana: sem `NEXT_PUBLIC_API_URL` o template vira a string
literal `"undefined/posts"` e o `fetch` estoura `ERR_INVALID_URL` **antes de
tocar a rede**. Um `catch` pensado para "API fora do ar" não pega isso, e o
Vercel não denuncia porque lá as variáveis existem — só a CI quebra.

Por isso `lib/api.js` e `lib/blog.js` caem em fallback em *qualquer* falha,
incluindo variável ausente. Já custou duas rodadas: a primeira correção pegou
só o `api.js` e deixou o `blog.js` para trás.

A exceção proposital é `getPost()`: a rota é renderizada sob demanda, então não
bloqueia o build, e devolver `null` com a API fora do ar viraria um 404
cacheado — que buscador lê como "o conteúdo sumiu". Lá um 500 é o certo.

**Para reproduzir o ambiente da CI:** tire o `apps/web/.env.local` do lugar e
rode o build. Com ele presente o cenário que quebra nunca aparece.

### 10. O deploy roda como `deploy`, não como root
Três coisas que só quebram no GitHub Actions porque à mão você roda como root:

- **Os segredos precisam estar no environment `producao`.** O job declara
  `environment: producao` e não enxerga segredo de environment com outro nome.
  Eles aparecem normalmente na tela de secrets e chegam **vazios** no workflow —
  a tela não denuncia nada.
- **`/var/backups/portfolio` precisa existir e ser do `deploy`.** O `backup-db.sh`
  faz `mkdir -p` ali, mas `/var/backups` é do root. Sem backup o `deploy.sh`
  aborta de propósito, então o deploy inteiro para. O `provision.sh` já cria.
- **O `deploy` não está no grupo `sudo`** — de propósito, para limitar o estrago
  se a chave do CI vazar. Tarefa de root é pelo console do painel da Hostinger.

E `API_URL` / `NEXT_PUBLIC_API_URL` são variáveis da **Vercel**: nenhum workflow
as lê. Cadastradas nos secrets do Actions elas não fazem nada.

### 11. O Hermes (`infra/hermes.env`) exige DOIS mecanismos de auth, não um
`GATEWAY_AUTH_TOKEN` protege o gateway (`8642`). Ele **não** cobre o dashboard
(`9119`) — o processo se recusa a escutar em `0.0.0.0` sem um provedor de auth
próprio registrado, e o forward-auth do nginx não conta para essa checagem
(é interna ao Hermes). Sem `HERMES_DASHBOARD_BASIC_AUTH_*` configurado, o
dashboard nunca abre a porta e `chat.vitorsierro.com` cai em erro de upstream
mesmo com o container "up" e saudável — o log é a única pista
(`Refusing to bind dashboard to 0.0.0.0 ... no auth providers are
registered`). Isso foi documentado ao contrário numa primeira versão deste
código (achamos que o basic auth duplicava o `/admin` e quebrava o login
único); na prática ele é obrigatório, e o custo é só um segundo prompt de
senha por sessão de navegador. Ver `infra/hermes.env.example`.

Dois detalhes que mordem ao gerar esse arquivo na VPS:
- **Não tem `node` no host** (só dentro dos containers) — gere tokens com
  `openssl rand -hex 32`, não com o one-liner de Node que funciona em dev.
- O handler `command-not-found` do Ubuntu, ao falhar, escreve parte do aviso
  em **stdout**. Se você tentar `node ... >> arquivo.env` num host sem Node,
  a mensagem de erro entra no arquivo como uma linha sem `=`, e o Compose
  falha depois com `key cannot contain a space` — sem apontar qual linha.

### 12. `docker compose -f infra/docker-compose.yml` nomeia o projeto `infra`, não `portfolio`
O nome do projeto vem do diretório que **contém o compose file**, não de onde
você roda o comando nem do nome do repo. Volumes e containers ficam
`infra_hermes_data`, `infra-api-1`, etc. — nunca `portfolio_*`. Confira sempre
com `docker volume ls`/`docker ps` antes de um `docker volume rm` ou
`docker compose down -v`; o nome errado normalmente só devolve "no such
volume" (inofensivo), mas não vale supor.

### 13. Validar `nginx -t` num serviço com rede própria recém-criada, num container já no ar, falha
O `deploy.sh` testa a config rodando `nginx -t` **dentro do container de nginx
que já está rodando** — que só está anexado às redes que existiam quando ele
subiu. Ao adicionar um serviço novo com rede isolada (caso do Hermes), o
primeiro deploy falha com `host not found in upstream`, mesmo com a config
correta, porque o nginx velho não enxerga a rede nova. A saída é rodar
`docker compose ... up -d --build` diretamente uma vez — ele cria a rede e
recria o nginx já anexado nela — e o `deploy.sh` volta a validar normalmente
dali em diante. Comentário completo em `infra/deploy.sh`.

### 14. O terminal backend do Hermes não pode ser `Docker`
O backend Docker do Hermes monta o socket do Docker no container — equivale a
dar root no host, e anularia toda a segmentação de rede e privilégios do
`design.md` §7. Use sempre `local` (`hermes setup terminal`): o próprio
container do Hermes já é o sandbox.

---

## Invariantes de segurança (não quebrar)

O desenho do login único depende destes pontos. Ver `infra/README.md` para o fluxo
completo e `infra/verify-auth.sh` para as asserções automatizadas.

1. **`JwtAuthGuard` lê SOMENTE o header `Authorization`.** Nunca adicione fallback por
   cookie — é a única mudança capaz de tornar toda mutação do CMS vulnerável a CSRF,
   já que o cookie de sessão é same-site a partir dos subdomínios das ferramentas.
2. **Nunca inclua `draw.` / `chat.` no `WEB_ORIGIN`** (allowlist de CORS e do
   `OriginCheckGuard`).
3. **O cookie de refresh é host-only** em `api.`, com `Path=/auth`. Nunca dê a ele
   `Domain=.vitorsierro.com` — mandaria a credencial de maior valor para as
   ferramentas a cada request.
4. **`admin_session` é token opaco com linha na tabela `Session`**, não JWT: a
   verificação já precisa consultar o banco para permitir revogação, então um JWT só
   somaria superfície de forja.
5. **`GET /auth/verify` responde 204 ou 401, nunca 3xx.** O `auth_request` do nginx
   trata qualquer outra coisa como 500, e o redirect é responsabilidade do proxy.
6. **`?next=` é validado por parse de `URL` + allowlist de hostname**
   (`apps/web/src/lib/tools.js`). Comparação por prefixo de string é furada por
   `//evil.com` e `https://vitorsierro.com@evil.com` — há testes para os dois.
