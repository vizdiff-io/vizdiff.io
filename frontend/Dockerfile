FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
RUN corepack enable
COPY .yarn/releases/yarn-4.3.0.cjs ./.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml tsconfig.json tsconfig.options.json ./
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/

RUN yarn install

FROM deps AS builder
ARG GIT_HASH=0000000000000000000000000000000000000000
ENV GIT_HASH=${GIT_HASH}
ENV NEXT_SKIP_ESLINT=1
COPY shared ./shared
COPY frontend ./frontend
RUN yarn workspace frontend build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/out /usr/share/nginx/html

EXPOSE 80
