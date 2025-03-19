# Stage 1: Building the code
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json files for all workspaces
COPY package.json yarn.lock ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install dependencies
RUN corepack enable && yarn install --frozen-lockfile

# Copy source code
COPY backend ./backend
COPY shared ./shared
COPY tsconfig.json ./

# Build the application
RUN yarn workspace backend build

# Stage 2: Running the application
FROM node:22-alpine

WORKDIR /app

# Copy package.json files
COPY package.json yarn.lock ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install production dependencies only
RUN corepack enable && yarn install --production --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared ./shared

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Run the application
CMD ["node", "backend/dist/index.js"]
