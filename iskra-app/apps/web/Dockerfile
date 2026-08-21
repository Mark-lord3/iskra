FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/web ./apps/web
RUN npm run build --workspace @iskra/web

FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/apps/web/dist ./dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]

