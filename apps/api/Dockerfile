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
  && yarn workspace api build

# ---

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl: required by Prisma's query engine.
# sqlite:  used by backup-db.sh (sqlite3 .backup).
RUN apk add --no-cache openssl sqlite

# Copy node_modules wholesale rather than reinstalling with --production:
# the start command runs `prisma migrate deploy`, and the Prisma CLI is a
# devDependency. A production-only install would drop it (and its engines),
# leaving migrations to a network fetch at boot. Costs image size, buys a
# deterministic startup.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
# tsconfig is needed at runtime too: `prisma db seed` runs prisma/seed.ts
# through ts-node, which reads it. Without this the admin seed fails in the
# container.
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json

# The SQLite file lives on a mounted volume so it survives redeploys.
VOLUME /data
EXPOSE 3001

WORKDIR /app/apps/api
CMD ["sh", "-c", "../../node_modules/.bin/prisma migrate deploy && node dist/main.js"]
