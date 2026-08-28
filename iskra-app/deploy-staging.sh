#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/iskra-app"
HOST="${ISKRA_HOST:-root@2.25.93.183}"
REMOTE_DIR="${ISKRA_DATING_STAGING_DIR:-/root/home/iskra-dating-staging}"
CADDY_DIR="${ISKRA_CADDY_DIR:-/root/home/orvadora}"
KEY="${ISKRA_KEY:-$HOME/.ssh/iskra_deploy}"
LOCAL_ENV="${ISKRA_DATING_STAGING_ENV_FILE:-$APP_DIR/apps/api/.env}"
PROMO_ENV="${ISKRA_STAGING_ENV_FILE:-$ROOT_DIR/server/.env}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -f "$KEY" ]] && SSH_OPTS+=(-i "$KEY")

say(){ printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
remote(){ ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }

[[ -f "$LOCAL_ENV" ]] || { echo "$LOCAL_ENV is missing" >&2; exit 1; }
[[ -f "$PROMO_ENV" ]] || { echo "$PROMO_ENV is missing" >&2; exit 1; }

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
EXISTING_ENV="$TEMP_DIR/existing.env"
RUNTIME_ENV="$TEMP_DIR/runtime.env"

say "Preparing isolated staging configuration"
remote "mkdir -p '$REMOTE_DIR/apps/api' '$REMOTE_DIR/dating-uploads'"
rsync -az -e "ssh ${SSH_OPTS[*]}" "$HOST:$REMOTE_DIR/apps/api/.env.runtime" "$EXISTING_ENV" 2>/dev/null || true
node "$APP_DIR/scripts/build-staging-env.mjs" "$LOCAL_ENV" "$PROMO_ENV" "$EXISTING_ENV" "$RUNTIME_ENV"

say "Uploading the dating staging application"
rsync -az --delete --delete-excluded -e "ssh ${SSH_OPTS[*]}" \
  --exclude '/node_modules/***' --exclude '/apps/*/node_modules/***' \
  --exclude '/apps/*/dist/***' --exclude '/apps/api/.env*' \
  --exclude '/dating-uploads/***' --exclude '*.log' --exclude '.DS_Store' \
  "$APP_DIR/" "$HOST:$REMOTE_DIR/"
rsync -az -e "ssh ${SSH_OPTS[*]}" "$RUNTIME_ENV" "$HOST:$REMOTE_DIR/apps/api/.env.runtime"

say "Building and starting isolated staging containers"
remote "cd '$REMOTE_DIR' && \
  COMPOSE_PROJECT_NAME=iskra-dating-staging \
  DATING_API_IMAGE=iskra-dating-api:staging \
  DATING_WEB_IMAGE=iskra-dating-web:staging \
  DATING_API_CONTAINER=iskra-dating-staging-api \
  DATING_WEB_CONTAINER=iskra-dating-staging-web \
  DATING_CLIENT_ORIGIN=https://dating.orvadora.com \
  DATING_PROMO_API_URL=http://iskra-staging:4310/api \
  docker compose -f docker-compose.production.yml up -d --build --remove-orphans"

say "Waiting for the dating staging API and web app"
remote "for container in iskra-dating-staging-api iskra-dating-staging-web; do
  for attempt in \$(seq 1 40); do
    status=\$(docker inspect --format='{{.State.Health.Status}}' \"\$container\" 2>/dev/null || echo starting)
    [ \"\$status\" = healthy ] && { echo \"  \$container: healthy\"; break; }
    [ \"\$attempt\" -eq 40 ] && { docker logs --tail=80 \"\$container\"; exit 1; }
    sleep 2
  done
done"

say "Synchronizing the active staging event"
remote "docker exec iskra-dating-staging-api node dist/seed.js"

say "Publishing dating.orvadora.com through Caddy"
remote "python3 - '$CADDY_DIR/Caddyfile' <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
start = '# BEGIN ISKRA dating staging'
end = '# END ISKRA dating staging'
block = '''# BEGIN ISKRA dating staging
dating.orvadora.com {
    encode zstd gzip
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
    }
    @backend path /api/v1/* /socket.io/*
    handle @backend {
        reverse_proxy iskra-dating-staging-api:4311
    }
    handle {
        reverse_proxy iskra-dating-staging-web:4173
    }
}
# END ISKRA dating staging'''
if start in text and end in text:
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    text = before.rstrip() + '\n\n' + block + after
else:
    text = text.rstrip() + '\n\n' + block + '\n'
path.write_text(text)
PY
docker exec orvadora-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec orvadora-caddy-1 caddy reload --config /etc/caddy/Caddyfile"

say "Verifying staging control wiring"
remote "docker exec iskra-dating-staging-api wget -qO- http://127.0.0.1:4311/api/v1/health; echo; docker exec iskra-dating-staging-api wget -qO- http://127.0.0.1:4311/api/v1/config; echo"

if [[ -n "$(dig +short dating.orvadora.com A | tail -1)" ]]; then
  say "Public staging verification"
  curl --fail --silent --show-error https://dating.orvadora.com/api/v1/health
  printf '\n'
else
  say "DNS action required"
  echo "Point dating.orvadora.com to 2.25.93.183 in Cloudflare, then rerun this script."
fi
