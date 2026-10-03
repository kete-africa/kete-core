# The app factory — built from the repository root (workspace packages). One process: its door
# and its worker. No secret is baked in; all come from the hosting's environment.
FROM node:22.14.0-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tooling/tsconfig tooling/tsconfig
COPY apps/factory/package.json apps/factory/
COPY packages/jobs/package.json packages/jobs/
COPY packages/sandbox/package.json packages/sandbox/
COPY packages/sdk/package.json packages/sdk/
COPY packages/tenancy/package.json packages/tenancy/
RUN pnpm install --frozen-lockfile --filter "@kete/factory..."
COPY packages packages
COPY apps/factory apps/factory

FROM node:22.14.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system kete && useradd --system --gid kete --home-dir /app kete
COPY --from=build --chown=kete:kete /app /app
WORKDIR /app/apps/factory
USER kete
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node_modules/.bin/tsx", "src/main.ts"]
