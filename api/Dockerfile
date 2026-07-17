# Node version is configurable via --build-arg NODE_VERSION; keep in sync with .nvmrc / root package.json engines
ARG NODE_VERSION=26

# Dependencies installation stage
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
# corepack is no longer bundled with Node >= 25, so install it explicitly before enabling
RUN npm install -g corepack && corepack enable
COPY .yarn/releases/ ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.options.json ./
# Copy ALL workspace package.jsons (not just this image's) so the workspace set matches
# yarn.lock — `--immutable` fails otherwise. Cheap and cache-friendly.
COPY api/package.json ./api/
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/
COPY worker/package.json ./worker/

RUN yarn install --immutable

# Build stage
FROM deps AS builder
COPY api ./api
COPY shared ./shared
RUN yarn workspace api build \
  && yarn workspaces focus api shared --production \
  && rm -rf api/src shared/src

# Final production image
ARG NODE_VERSION=26
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001

# Copy built files and dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/api/package.json ./api/package.json
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/shared ./shared

EXPOSE 3001

# Product version, injected by the release workflow (release.yml). Kept as the last layer so a
# release rebuild only invalidates this step. Defaults to "dev" for main/edge builds.
ARG VIZDIFF_VERSION=dev
ENV VIZDIFF_VERSION=${VIZDIFF_VERSION}

CMD ["node", "--enable-source-maps", "api/dist/index.mjs"]
