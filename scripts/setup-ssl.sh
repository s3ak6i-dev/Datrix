#!/usr/bin/env bash
# One-time SSL certificate issuance via Let's Encrypt + Certbot.
# Run this ONCE before starting the production stack.
#
# Usage: DOMAIN=your.domain.com EMAIL=you@example.com bash scripts/setup-ssl.sh
#
# Prerequisites:
#   - Docker + Docker Compose installed
#   - Port 80 open on your server
#   - DNS A record for $DOMAIN pointing to this server's IP

set -euo pipefail

: "${DOMAIN:?DOMAIN env var is required (e.g. export DOMAIN=datrix.example.com)}"
: "${EMAIL:?EMAIL env var is required for Let's Encrypt notifications}"

# Replace placeholder in nginx config
sed -i "s/YOUR_DOMAIN/${DOMAIN}/g" nginx/nginx.conf

# Bring up nginx on HTTP only (no SSL block yet) to serve the ACME challenge
cat > /tmp/nginx-init.conf << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'Datrix SSL init';
    }
}
EOF

docker run --rm -d \
  --name nginx-init \
  -p 80:80 \
  -v /tmp/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro \
  -v certbot_www:/var/www/certbot \
  nginx:alpine

echo "Issuing certificate for ${DOMAIN}..."
docker run --rm \
  -v certbot_certs:/etc/letsencrypt \
  -v certbot_www:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}"

docker stop nginx-init

echo ""
echo "Certificate issued successfully."
echo "Start the production stack with:"
echo "  DOMAIN=${DOMAIN} docker compose -f docker-compose.production.yml up -d"
