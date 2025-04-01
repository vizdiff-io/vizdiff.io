FROM node:22-alpine

WORKDIR /app

# Build args
ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ARG NODE_ENV=production

# Install Chromium and its dependencies
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont && \
    # Create symlink for WebdriverIO compatibility
    ln -s /usr/bin/chromium-browser /usr/bin/google-chrome

# Add Chrome flags and debugging
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser

# Create a non-root user and set up directories
RUN addgroup -S webuser && adduser -S -G webuser webuser \
    && mkdir -p /home/webuser/Downloads /home/webuser/.cache \
    && chown -R webuser:webuser /home/webuser \
    && chmod 755 /home/webuser \
    && chown -R webuser:webuser /app

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
ENV DD_GIT_COMMIT_SHA=$DD_GIT_COMMIT_SHA \
    DD_GIT_REPOSITORY_URL=$DD_GIT_REPOSITORY_URL \
    NODE_ENV=$NODE_ENV \
    HOME=/home/webuser

# Switch to non-root user
USER webuser
WORKDIR /home/webuser

# Create startup script in the home directory (after all other operations)
RUN printf '#!/bin/sh\nchromedriver --port=4444 --whitelisted-ips="127.0.0.1" &\nsleep 2\nexec node --enable-source-maps --import /app/node_modules/dd-trace/register.js /app/worker/dist/worker.mjs\n' > start.sh && chmod +x start.sh

# Run the application
CMD ["./start.sh"]
