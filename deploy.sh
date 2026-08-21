#!/usr/bin/env bash
# Deploy ISKRA to the VPS behind iskra.orvadora.com.
#
#   ./deploy.sh            build + (re)start the app, wire up the proxy
#   ./deploy.sh --seed     same, then load events/promo codes/demo players
#   ./deploy.sh --logs     tail the app container
#
# ISKRA shares the Caddy that already serves orvadora.com on this box, so this
# script never binds ports 80/443 and never restarts the orvadora stack — it
# only appends a site block to that Caddyfile and reloads Caddy gracefully.
set -euo pipefail

HOST="${ISKRA_HOST:-root@2.25.93.183}"
DIR="${ISKRA_DIR:-/root/home/iskra}"
DOMAIN="iskra.orvadora.com"
CADDY_DIR="${ISKRA_CADDY_DIR:-/root/home/orvadora}"
CADDY_CTR="${ISKRA_CADDY_CTR:-orvadora-caddy-1}"
KEY="${ISKRA_KEY:-$HOME/.ssh/iskra_deploy}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -f "$KEY" ]] && SSH_OPTS+=(-i "$KEY")

say(){ printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
remote(){ ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }

if [[ "${1:-}" == "--logs" ]]; then
  remote "cd $DIR && docker compose logs -f --tail=100"; exit 0
fi

# --- preflight ------------------------------------------------------------
[[ -f server/.env ]] || { echo "server/.env is missing — it carries MONGODB_URI"; exit 1; }
grep -q '^MONGODB_URI=' server/.env || { echo "server/.env has no MONGODB_URI"; exit 1; }

say "Connecting to $HOST"
remote "echo '  host:' \$(hostname); docker --version | sed 's/^/  /'"

# --- upload ---------------------------------------------------------------
say "Uploading project to $DIR"
remote "mkdir -p $DIR"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
  --exclude '*.log' --exclude '.DS_Store' \
  ./ "$HOST:$DIR/"
echo "  uploaded (server/.env included — excluded from git, not from rsync)"

# --- build + run ----------------------------------------------------------
say "Building and starting the app container"
remote "cd $DIR && docker compose up -d --build --remove-orphans"

say "Waiting for the app to report healthy"
remote "for i in \$(seq 1 40); do
          s=\$(docker inspect --format='{{.State.Health.Status}}' iskra-app 2>/dev/null || echo starting)
          [ \"\$s\" = healthy ] && { echo '  app: healthy'; exit 0; }
          [ \$i -eq 40 ] && { echo \"  app never became healthy (last: \$s)\"; docker logs --tail=30 iskra-app; exit 1; }
          sleep 2
        done"

# --- proxy ----------------------------------------------------------------
say "Wiring $DOMAIN into the existing Caddy"
remote "set -e
  cd $CADDY_DIR
  if grep -q '$DOMAIN' Caddyfile; then
    echo '  site block already present'
  else
    cp Caddyfile Caddyfile.bak.\$(date +%Y%m%d-%H%M%S)
    printf '\n%s {\n    encode zstd gzip\n    reverse_proxy iskra-app:4310\n}\n' '$DOMAIN' >> Caddyfile
    echo '  site block appended (previous Caddyfile backed up)'
  fi
  # Validate the file on the HOST, in a throwaway container. Validating inside
  # the running Caddy is useless: its bind-mounted Caddyfile is pinned to the
  # inode present at container start, so it cannot see edits made here.
  docker run --rm -e ACME_EMAIL=\${ACME_EMAIL:-hello@orvadora.com} \
    -v $CADDY_DIR/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2.10-alpine \
    caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 \
    && echo '  caddyfile valid' \
    || { echo '  INVALID Caddyfile — restoring backup and aborting'; cp \$(ls -t Caddyfile.bak.* | head -1) Caddyfile; exit 1; }

  # For the same reason 'caddy reload' is a no-op after editing the host file
  # ('config is unchanged'); the container must be recreated to re-read it.
  # Only caddy is touched — the web and api containers keep running.
  docker compose up -d --force-recreate caddy 2>&1 | tail -2
  echo '  caddy recreated (web + api untouched)'"

if [[ "${1:-}" == "--seed" ]]; then
  say "Seeding the database"
  remote "cd $DIR && docker compose exec -T app node server/src/seed.js"
fi

say "Checking both sites"
remote "for u in https://$DOMAIN/api/health https://orvadora.com; do
          printf '  %-45s -> %s\n' \"\$u\" \"\$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \$u || echo FAILED)\"
        done"

say "Done — https://$DOMAIN"
echo "  logs:    ./deploy.sh --logs"
echo "  restart: ssh $HOST 'cd $DIR && docker compose restart'"
