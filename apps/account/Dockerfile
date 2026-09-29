# Compte Kete — built from the repository root, because it depends on workspace packages
# (@kete/design, @kete/sdk, @kete/files). Vite builds; srvx serves SSR and static files.

FROM node:22.14.0-bookworm-slim AS build
WORKDIR /app

# pnpm is installed explicitly: corepack signature checks have broken builds before.
RUN npm install -g pnpm@11.25.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tooling/tsconfig tooling/tsconfig
COPY apps/account/package.json apps/account/
COPY packages/auth/package.json packages/auth/
COPY packages/design/package.json packages/design/
COPY packages/files/package.json packages/files/
COPY packages/sdk/package.json packages/sdk/
RUN pnpm install --frozen-lockfile --filter "@kete/account..."

COPY packages packages
COPY apps/account apps/account
RUN pnpm --filter @kete/account build

FROM node:22.14.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system kete && useradd --system --gid kete --home-dir /app kete

COPY --from=build --chown=kete:kete /app/node_modules ./node_modules
COPY --from=build --chown=kete:kete /app/packages ./packages
COPY --from=build --chown=kete:kete /app/apps/account/node_modules ./apps/account/node_modules
COPY --from=build --chown=kete:kete /app/apps/account/package.json ./apps/account/package.json
COPY --from=build --chown=kete:kete /app/apps/account/dist ./apps/account/dist

WORKDIR /app/apps/account
USER kete
EXPOSE 3000

# Coolify's own probe needs curl or wget, absent from the slim image: the image probes itself.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=6 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

# The static directory is an absolute path: srvx does not always resolve a relative one.
CMD ["node_modules/.bin/srvx", "serve", "--entry", "dist/server/server.js", "--static", "/app/apps/account/dist/client", "--prod", "--host", "0.0.0.0", "--port", "3000"]
