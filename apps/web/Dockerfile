FROM node:24.21.0-slim AS pruner
ARG TURBO_VERSION=2.11.7
WORKDIR /repo
RUN npm install --global turbo@${TURBO_VERSION}
COPY . .
RUN turbo prune @dv-lab/web --docker

FROM node:24.21.0-slim AS builder
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN node .yarn/releases/yarn-4.18.1.cjs install --immutable
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json ./
RUN node .yarn/releases/yarn-4.18.1.cjs turbo run build --filter=@dv-lab/web

FROM node:24.21.0-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
