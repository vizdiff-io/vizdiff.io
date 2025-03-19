# Stage 1: Building the code
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json files for all workspaces
COPY package.json yarn.lock ./
COPY worker/package.json ./worker/
COPY shared/package.json ./shared/

# Install dependencies
RUN corepack enable && yarn install --frozen-lockfile

# Copy source code
COPY worker ./worker
COPY shared ./shared
COPY tsconfig.json ./

# Build the application
RUN yarn workspace worker build

# Stage 2: Running the application
FROM node:22-alpine

WORKDIR /app

# Copy package.json files
COPY package.json yarn.lock ./
COPY worker/package.json ./worker/
COPY shared/package.json ./shared/

# Install production dependencies only
RUN corepack enable && yarn install --production --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/worker/dist ./worker/dist
COPY --from=builder /app/shared ./shared

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "worker/dist/index.js"]
