# E2E (Cypress)

Os specs em `cypress/e2e/` rodam contra o `yarn dev` local de verdade (web +
api), nao contra mocks — sao testes end-to-end.

## Pre-requisitos

1. `yarn dev` rodando na raiz do repo (web:3000 + api:3001).
2. Banco da API seedado: `yarn workspace api prisma:migrate && yarn workspace api prisma:seed`.
3. Credenciais do admin seedado exportadas como variaveis de ambiente
   (nao commitar num arquivo rastreado pelo git — use `apps/web/cypress.env.json`,
   que ja esta no `.gitignore` do projeto, ou exporte no shell):

   ```bash
   export CYPRESS_ADMIN_EMAIL="admin@vitorsierro.dev"
   export CYPRESS_ADMIN_PASSWORD="sua-senha-local"
   ```

   Devem bater com `ADMIN_EMAIL`/`ADMIN_PASSWORD` de `apps/api/.env`.

Os specs de blog assumem os posts de exemplo do seed (`SEED_SAMPLE_POSTS`
diferente de `false`).

## Rodando

```bash
yarn workspace web cypress:open   # modo interativo
yarn workspace web cypress:run    # headless, usado em CI
```

## Por que nao mockar tudo

`lib/auth.js` guarda o access token só em memória no cliente — só é
preenchido depois de passar pelo formulário de login de verdade (ou por um
`refresh()` via cookie). Por isso `loginAsAdmin()` (em
`cypress/support/commands.js`) sempre dirige a UI de login, nunca faz login
"por baixo dos panos" com `cy.request`.
