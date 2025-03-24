FROM node:22-alpine

WORKDIR /app

# Copy yarn/tsconfig files
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.options.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/

# Copy source code needed for build
COPY api ./api
COPY shared ./shared

# Install dependencies and build
RUN corepack enable && \
    yarn install --immutable && \
    yarn workspace api build && \
    yarn workspaces focus api shared --production && \
    # Clean up source files, keeping only what's needed for runtime
    rm -rf api/src && \
    rm -rf shared/src

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Run the application
CMD ["node", "api/dist/index.mjs"]
