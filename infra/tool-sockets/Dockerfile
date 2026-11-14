FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY proxy.cjs server.cjs ./
USER node
EXPOSE 8080
CMD ["node", "server.cjs"]
