#!/usr/bin/env bash

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Check if FQDN argument is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <fqdn>"
    echo "Example: $0 badger.mole-acoustic.ts.net"
    exit 1
fi

FQDN=$1

# Generate nginx config
cat > nginx.conf << EOF
server {
    listen 443 ssl;
    server_name ${FQDN};

    ssl_certificate /etc/ssl/certs/cert.crt;
    ssl_certificate_key /etc/ssl/certs/cert.key;

    location /api/ {
        proxy_pass http://host.docker.internal:3001/;
    }
    location / {
        proxy_pass http://host.docker.internal:3000/;
    }
}
EOF

# Check if the dev gateway container is already running
CONTAINER=$(docker ps --filter name=vizdiff-dev-gateway -q)

# If the container is running, stop it and remove it
if [ -n "$CONTAINER" ]; then
  docker stop vizdiff-dev-gateway
  docker rm vizdiff-dev-gateway
fi

# Start the dev gateway Docker container
docker run \
  --name vizdiff-dev-gateway \
  -v ${SCRIPT_DIR}/nginx.conf:/etc/nginx/conf.d/default.conf \
  -v ${SCRIPT_DIR}/certs:/etc/ssl/certs \
  -p 443:443 \
  -d \
  nginx:latest

echo "Dev gateway started on https://${FQDN}"
