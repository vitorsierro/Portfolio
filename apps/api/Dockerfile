# Build from the repo root so the yarn workspace layout is preserved:
#   docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS builder
WORKDIR /app

# Workspace manifests first — keeps the install layer cached across code edits.
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/
RUN yarn install --frozen-lockfile

COPY apps/api ./apps/api
RUN yarn workspace api prisma:generate \
  && yarn workspace api build \
  && yarn tsc apps/api/prisma/seed.ts --target es2021 --module commonjs --esModuleInterop --skipLibCheck --outDir /app/seed

FROM node:22-alpine AS production-deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/
RUN yarn install --production=true --frozen-lockfile \
  && mkdir -p /app/apps/api/node_modules

# ---

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl: required by Prisma's query engine.
# sqlite:  used by backup-db.sh (sqlite3 .backup).
RUN apk add --no-cache openssl sqlite
RUN mkdir -p /data && chown node:node /data

# Apenas dependências de produção; Prisma CLI é necessário para migrations.
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Os dois níveis são necessários: em yarn workspaces nem tudo sobe para a raiz.
# O @nestjs, por exemplo, fica em apps/api/node_modules, e copiar só a raiz
# deixa o container subindo em loop com "Cannot find module '@nestjs/common'".
COPY --from=production-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/seed/seed.js ./apps/api/prisma/seed.js
RUN node -e "const fs=require('fs');const path='apps/api/package.json';const p=JSON.parse(fs.readFileSync(path));p.prisma.seed='node prisma/seed.js';fs.writeFileSync(path,JSON.stringify(p));"

# The SQLite file lives on a mounted volume so it survives redeploys.
VOLUME /data
EXPOSE 3001

WORKDIR /app/apps/api
USER node
CMD ["sh", "-c", "../../node_modules/.bin/prisma migrate deploy && node dist/main.js"]
