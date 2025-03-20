# Stage 1: Building the code
FROM node:22-alpine AS builder

WORKDIR /app

# Copy yarn/tsconfig files
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.options.json ./
COPY worker/package.json ./worker/
COPY shared/package.json ./shared/

# Install dependencies
RUN corepack enable && yarn install

# Copy source code
COPY worker ./worker
COPY shared ./shared

# Build the application
RUN yarn workspace worker build

# Stage 2: Running the application
FROM node:22-alpine

WORKDIR /app

# Copy package.json files
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml ./
COPY worker/package.json ./worker/
COPY shared/package.json ./shared/

# Install dependencies
RUN corepack enable && yarn install

# Copy built application from builder stage
COPY --from=builder /app/worker/dist ./worker/dist
COPY --from=builder /app/shared ./shared

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "worker/dist/worker.mjs"]
