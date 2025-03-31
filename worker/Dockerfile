FROM node:22-alpine

WORKDIR /app

# Install Chromium and its dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont && \
    # Create symlink for WebdriverIO compatibility
    ln -s /usr/bin/chromium-browser /usr/bin/google-chrome

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy yarn/tsconfig files
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.options.json ./
COPY worker/package.json ./worker/
COPY shared/package.json ./shared/

# Copy source code needed for build
COPY worker ./worker
COPY shared ./shared

# Install dependencies and build
RUN corepack enable && \
    yarn install && \
    yarn workspace worker build && \
    yarn workspaces focus worker shared --production && \
    # Clean up source files, keeping only what's needed for runtime
    rm -rf worker/src && \
    rm -rf shared/src

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "--import", "dd-trace/register.js", "worker/dist/worker.mjs"]
