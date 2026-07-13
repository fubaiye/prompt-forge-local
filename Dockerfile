# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    PROMPT_FORGE_HOST=0.0.0.0 \
    PROMPT_FORGE_PORT=8787 \
    PROMPT_FORGE_DATA_DIR=/app/data \
    PROMPT_FORGE_CLIENT_DIST=/app/dist

WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 8787
CMD ["node", "build/server/index.mjs"]
