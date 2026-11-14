# Aproveita apenas o código publicado; o Node/Alpine antigos não vão ao runner.
FROM excalidraw/excalidraw-room@sha256:2fe999f9be4379e3ee282fc45d75d84a691a6383dde33544514cc395287c7a70 AS source
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 CORS_ORIGIN=https://draw.vitorsierro.com
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=source /excalidraw-room/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
