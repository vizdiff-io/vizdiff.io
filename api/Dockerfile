# Base stage with Node.js 22 Alpine
FROM node:22-alpine AS base
WORKDIR /app

# Dependencies installation stage
FROM base AS deps
RUN corepack enable
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.options.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/

RUN yarn install

# Build stage
FROM deps AS builder
COPY api ./api
COPY shared ./shared
RUN yarn workspace api build \
  && yarn workspaces focus api shared --production \
  && rm -rf api/src shared/src

# Final production image
FROM base
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

CMD ["node", "--enable-source-maps", "--import", "dd-trace/register.js", "api/dist/index.mjs"]
