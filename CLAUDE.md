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

### 11. O dashboard do Hermes exige auth própria SE o bind não for loopback
`GATEWAY_AUTH_TOKEN` protege o gateway (`8642`). Ele **não** cobre o dashboard
(`9119`) — o processo se recusa a escutar fora do loopback sem um provedor de
auth próprio registrado, e o forward-auth do nginx não conta para essa
checagem (é interna ao Hermes). O log é explícito quando falta:
`Refusing to bind dashboard to 0.0.0.0 ... no auth providers are registered`.

Em vez de conviver com um segundo login, `docker-compose.yml`/`docker-compose.dev.yml`
fazem o Hermes bindar em `127.0.0.1` de verdade e usam o sidecar `hermes-proxy`
(armadilha #15) para tornar essa porta alcançável mesmo assim — o gate nunca
engata porque, do ponto de vista do processo, a conexão sempre vem do
loopback. Só `docker-compose.local.yml` (publica porta direto no host, sem
sidecar) ainda precisa de `HERMES_DASHBOARD_BASIC_AUTH_*`. Isso foi
documentado de duas formas diferentes ao longo do desenvolvimento — primeiro
"nunca habilite" (errado: quebra o dashboard), depois "sempre habilite"
(correto, mas substituído pelo sidecar assim que percebemos que dava para
eliminar o segundo login de vez). Ver `infra/hermes.env.example`.

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

### 15. `hermes-proxy` é um sidecar que compartilha a rede do Hermes, não um serviço na rede `hermes`
`network_mode: "service:hermes"` faz o sidecar herdar a *network namespace*
inteira do container do Hermes — mesma interface, mesmo IP, mesmo loopback.
Por isso ele **não** declara `networks: [hermes]` própria (Compose rejeita
combinar as duas coisas) e, ao alcançar `127.0.0.1:9119`, está falando com o
Hermes como um processo vizinho falaria — não pela rede Docker. É esse
detalhe que faz o gate de auth do dashboard nunca engatar (armadilha #11):
para o processo, a conexão sempre parece vir do loopback.

Duas consequências:
- **`depends_on: [hermes]`** no sidecar é obrigatório — ele precisa da
  namespace do Hermes já existir para se anexar a ela.
- **A rede `hermes` vira a única barreira do dashboard**, sem a defesa extra
  que a auth própria do Hermes daria. Não adicione mais nenhum serviço a essa
  rede sem reler o comentário em `docker-compose.yml` — ver `design.md` §7.

### 16. Loopback resolve o gate de auth do Hermes, mas não a guarda anti-DNS-rebinding — são duas checagens diferentes
Depois do sidecar (armadilha #15), o dashboard abria e devolvia `400 Bad
Request` para toda requisição vinda do nginx. A causa não tinha nada a ver com
autenticação: é uma guarda **separada**, contra DNS rebinding, que valida o
header `Host` — e só aceita variantes de loopback (`127.0.0.1:9119` funciona;
qualquer outra coisa, incluindo `chat.vitorsierro.com`, cai em 400. Não existe
flag para estender essa allowlist hoje — issue aberta no upstream,
[NousResearch/hermes-agent#34390](https://github.com/NousResearch/hermes-agent/issues/34390).

O sintoma engana porque parece falha do sidecar (a primeira suspeita foi
"`socat` não está encaminhando"), mas testar com `wget` direto no loopback
compartilhado prova o contrário: sem `--header`, sucesso; forçando
`Host: chat.vitorsierro.com`, o mesmo 400. O fix é o nginx mandar
`Host: 127.0.0.1:9119` para o upstream (em vez de `$host`) e preservar o
domínio real em `X-Forwarded-Host` — ver `infra/nginx/conf.d/hermes.conf`.

**Para depurar isso de novo:** rode `wget` de dentro do `hermes-proxy` contra
`127.0.0.1:9119` com e sem `--header='Host: ...'` explícito. Se o primeiro
funciona e o segundo não, é sempre esta guarda, não a rede.

### 17. Mudança SÓ em `infra/nginx/` não recarrega o nginx sozinha — o `deploy.sh` só validava, nunca recarregava
`nginx -t` lê o arquivo do disco (o bind mount já reflete o `git pull`, é por
isso que valida "antes de recarregar"), mas isso é só validação — não aplica
nada. O `$COMPOSE up -d --build` que vem depois só recria um container se a
**definição do serviço** no compose mudou (imagem, env, volumes); conteúdo de
arquivo montado é invisível para essa checagem. Resultado: o nginx que já
estava no ar continuava servindo a config **antiga** em memória, e só pegaria
a nova no reload automático de 6h que já existe no `command` do serviço.

Isso custou uma rodada inteira de diagnóstico tentando corrigir a armadilha
#16 (achando que era o `Host` errado, depois `X-Forwarded-Host`, depois rede)
quando na real o arquivo certo nunca tinha sido recarregado — `cat` no
container mostrava o conteúdo novo (lido do disco), mas o processo do nginx
ainda respondia com o comportamento antigo. `deploy.sh` agora roda
`nginx -s reload` explicitamente depois do `up -d --build`, sempre que o
nginx já estava rodando — reload de config já atual é barato, não custa nada
rodar mesmo quando não havia nada para aplicar.

**Se isso acontecer nas mãos (fora do `deploy.sh`):** depois de qualquer
`git pull` que só tocou `infra/nginx/`, rode `nginx -t` E `nginx -s reload`
— o primeiro sozinho nunca é suficiente.

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
