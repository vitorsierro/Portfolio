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

---

## Invariantes de segurança (não quebrar)

O desenho do login único depende destes pontos. Ver `infra/README.md` para o fluxo
completo e `infra/verify-auth.sh` para as asserções automatizadas.

1. **`JwtAuthGuard` lê SOMENTE o header `Authorization`.** Nunca adicione fallback por
   cookie — é a única mudança capaz de tornar toda mutação do CMS vulnerável a CSRF,
   já que o cookie de sessão é same-site a partir dos subdomínios das ferramentas.
2. **Nunca inclua `draw.` / `claw.` no `WEB_ORIGIN`** (allowlist de CORS e do
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
