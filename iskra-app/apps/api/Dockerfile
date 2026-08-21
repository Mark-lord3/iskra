FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install
COPY apps/api ./apps/api
RUN npm run build --workspace @iskra/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
RUN mkdir -p /app/uploads
EXPOSE 4311
CMD ["node", "dist/index.js"]

