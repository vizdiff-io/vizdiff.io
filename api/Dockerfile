FROM node:22-alpine

WORKDIR /app

# Build args
ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ARG NODE_ENV=production

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
    yarn install && \
    yarn workspace api build && \
    yarn workspaces focus api shared --production && \
    # Clean up source files, keeping only what's needed for runtime
    rm -rf api/src && \
    rm -rf shared/src

# Set environment variables
ENV DD_GIT_COMMIT_SHA=$DD_GIT_COMMIT_SHA \
    DD_GIT_REPOSITORY_URL=$DD_GIT_REPOSITORY_URL \
    NODE_ENV=$NODE_ENV \
    PORT=3001

# Expose the port
EXPOSE 3001

# Run the application
CMD ["node", "--enable-source-maps", "--import", "dd-trace/register.js", "api/dist/index.mjs"]
