#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/iskra-app"
HOST="${ISKRA_HOST:-root@2.25.93.183}"
REMOTE_DIR="${ISKRA_DATING_DIR:-/root/home/iskra-dating-production}"
CADDY_DIR="${ISKRA_CADDY_DIR:-/root/home/orvadora}"
KEY="${ISKRA_KEY:-$HOME/.ssh/iskra_deploy}"
LOCAL_ENV="${ISKRA_DATING_ENV_FILE:-$APP_DIR/apps/api/.env}"
PROMO_ENV="${ISKRA_PRODUCTION_ENV_FILE:-$ROOT_DIR/server/.env}"
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

say "Preparing isolated production configuration"
remote "mkdir -p '$REMOTE_DIR/apps/api' '$REMOTE_DIR/dating-uploads'" 
rsync -az -e "ssh ${SSH_OPTS[*]}" "$HOST:$REMOTE_DIR/apps/api/.env.runtime" "$EXISTING_ENV" 2>/dev/null || true
node "$APP_DIR/scripts/build-production-env.mjs" "$LOCAL_ENV" "$PROMO_ENV" "$EXISTING_ENV" "$RUNTIME_ENV"

say "Uploading the dating application"
rsync -az --delete --delete-excluded -e "ssh ${SSH_OPTS[*]}" \
  --exclude '/node_modules/***' --exclude '/apps/*/node_modules/***' \
  --exclude '/apps/*/dist/***' --exclude '/apps/api/.env*' \
  --exclude '/dating-uploads/***' --exclude '*.log' --exclude '.DS_Store' \
  "$APP_DIR/" "$HOST:$REMOTE_DIR/"
rsync -az -e "ssh ${SSH_OPTS[*]}" "$RUNTIME_ENV" "$HOST:$REMOTE_DIR/apps/api/.env.runtime"

say "Building and starting isolated production containers"
remote "cd '$REMOTE_DIR' && COMPOSE_PROJECT_NAME=iskra-dating-production docker compose -f docker-compose.production.yml up -d --build --remove-orphans"

say "Waiting for the dating API and web app"
remote "for container in iskra-dating-api iskra-dating-web; do
  for attempt in \$(seq 1 40); do
    status=\$(docker inspect --format='{{.State.Health.Status}}' \"\$container\" 2>/dev/null || echo starting)
    [ \"\$status\" = healthy ] && { echo \"  \$container: healthy\"; break; }
    [ \"\$attempt\" -eq 40 ] && { docker logs --tail=80 \"\$container\"; exit 1; }
    sleep 2
  done
done"

say "Synchronizing the active production event"
remote "docker exec iskra-dating-api node dist/seed.js"

say "Publishing dating.project-iskra.com through Caddy"
remote "python3 - '$CADDY_DIR/Caddyfile' <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
start = '# BEGIN ISKRA dating production'
end = '# END ISKRA dating production'
block = '''# BEGIN ISKRA dating production
dating.project-iskra.com {
    encode zstd gzip
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
    }
    @backend path /api/v1/* /socket.io/*
    handle @backend {
        reverse_proxy iskra-dating-api:4311
    }
    handle {
        reverse_proxy iskra-dating-web:4173
    }
}
# END ISKRA dating production'''
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

say "Verifying production control wiring"
remote "docker exec iskra-dating-api wget -qO- http://127.0.0.1:4311/api/v1/health; echo; docker exec iskra-dating-api wget -qO- http://127.0.0.1:4311/api/v1/config; echo"

if [[ "$(dig +short dating.project-iskra.com A | tail -1)" == "2.25.93.183" ]]; then
  say "Live verification"
  curl --fail --silent --show-error https://dating.project-iskra.com/api/v1/health
  printf '\n'
else
  say "DNS action required"
  echo "Add an A record in Cloudflare: dating -> 2.25.93.183 (DNS only until HTTPS is issued)."
fi
