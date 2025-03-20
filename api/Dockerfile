# Stage 1: Building the code
FROM node:22-alpine AS builder

WORKDIR /app

# Copy yarn/tsconfig files
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.options.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/

# Install dependencies
RUN corepack enable && yarn install

# Copy source code
COPY api ./api
COPY shared ./shared

# Build the application
RUN yarn workspace api build

# Stage 2: Running the application
FROM node:22-alpine

WORKDIR /app

# Copy package.json files
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/

# Install dependencies
RUN corepack enable && yarn install

# Copy built application from builder stage
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/shared ./shared

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Run the application
CMD ["node", "api/dist/index.mjs"]
