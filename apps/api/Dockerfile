FROM node:24.21.0-slim AS pruner
ARG TURBO_VERSION=2.11.7
WORKDIR /repo
RUN npm install --global turbo@${TURBO_VERSION}
COPY . .
RUN turbo prune @dv-lab/api --docker

FROM node:24.21.0-slim AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN node .yarn/releases/yarn-4.18.1.cjs install --immutable
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json ./
RUN node .yarn/releases/yarn-4.18.1.cjs turbo run build --filter=@dv-lab/api
RUN node .yarn/releases/yarn-4.18.1.cjs workspaces focus --production @dv-lab/api

FROM node:24.21.0-slim AS runner
ARG GIT_SHA=unknown
ENV NODE_ENV=production GIT_SHA=$GIT_SHA
WORKDIR /app
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "apps/api/dist/server.mjs"]
