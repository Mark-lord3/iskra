# ---------- stage 1: build the React client ----------
FROM node:22-alpine AS client-build
WORKDIR /build

COPY client/package*.json ./client/
RUN npm ci --prefix client

COPY client/ ./client/
RUN npm run build --prefix client


# ---------- stage 2: runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Server dependencies only — no dev tooling in the final image.
COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix server && npm cache clean --force

COPY server/src ./server/src
COPY shared ./shared

# Catch missing runtime-only source imports while the image is still building.
RUN node --input-type=module -e "import('./server/src/routes/players.js')"

# The Express app serves ../../client/dist relative to server/src,
# so the built assets keep the same layout they have in the repo.
COPY --from=client-build /build/client/dist ./client/dist

# Run unprivileged.
RUN chown -R node:node /app
USER node

EXPOSE 4310

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-4310}/api/health || exit 1

CMD ["node", "server/src/index.js"]
