# Base image with Chromium dependencies
FROM node:24-alpine AS base
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-cjk \
    font-noto-emoji \
    font-noto-extra && \
    ln -s /usr/bin/chromium-browser /usr/bin/google-chrome

# Add Puppeteer/Chrome flags to make WebDriver work with Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser

# Create a non-root user and set up directories
RUN addgroup -S webuser && adduser -S -G webuser webuser \
    && mkdir -p /home/webuser/Downloads /home/webuser/.cache \
    && chown -R webuser:webuser /home/webuser \
    && chmod 755 /home/webuser

WORKDIR /app

# Install dependencies separately (cached independently)
FROM base AS deps
RUN corepack enable
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.options.json ./
COPY worker/package.json ./worker/
COPY shared/package.json ./shared/

RUN yarn install

# Build workspace separately (cached until source changes)
FROM deps AS builder
COPY worker ./worker
COPY shared ./shared
RUN yarn workspace worker build \
  && yarn workspaces focus worker shared --production \
  && chown -R webuser:webuser /app

# Final production image
FROM base
ENV NODE_ENV=production \
    HOME=/home/webuser

# Copy built files and dependencies from builder stage
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/worker/package.json /app/worker/package.json
COPY --from=builder /app/shared/package.json /app/shared/package.json
COPY --from=builder /app/worker/dist /app/worker/dist
COPY --from=builder /app/shared /app/shared

# Switch to non-root user
USER webuser
WORKDIR /home/webuser

# Create startup script in the home directory (after all other operations)
RUN printf '#!/bin/sh\nchromedriver --port=4444 --whitelisted-ips="127.0.0.1" &\nsleep 2\nexec node --enable-source-maps --import /app/node_modules/dd-trace/register.js /app/worker/dist/worker.mjs\n' > start.sh && chmod +x start.sh

# Run the application
CMD ["./start.sh"]
