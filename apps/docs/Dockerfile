# The kete-core documentation site — built from the repository root, because the site is made of
# the repository's own Markdown, contracts and package code (decision 0006). Served as static files.

FROM node:22.14.0-bookworm-slim AS build
WORKDIR /app

# pnpm is installed explicitly: corepack signature checks have broken builds before.
RUN npm install -g pnpm@11.25.0

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm docs:build

FROM nginx:1.29-alpine
COPY --from=build /app/apps/docs/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=6 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/"]
