#!/usr/bin/env bash
# Explicit two-environment deployment for the shared Hostinger VPS.
set -euo pipefail

ENVIRONMENT="${1:-}"
[[ -n "$ENVIRONMENT" ]] && shift
case "$ENVIRONMENT" in
  production)
    DOMAIN="project-iskra.com"
    DOMAIN_LIST="project-iskra.com + www.project-iskra.com"
    DIR="${ISKRA_PRODUCTION_DIR:-/root/home/iskra-production}"
    CONTAINER="iskra-production"
    PROJECT="iskra-production"
    IMAGE="iskra-promo:production"
    STRIPE_MODE="live"
    LOCAL_ENV="${ISKRA_PRODUCTION_ENV_FILE:-server/.env}"
    ;;
  staging)
    DOMAIN="iskra.orvadora.com"
    DOMAIN_LIST="iskra.orvadora.com"
    DIR="${ISKRA_STAGING_DIR:-/root/home/iskra-staging}"
    CONTAINER="iskra-staging"
    PROJECT="iskra-staging"
    IMAGE="iskra-promo:staging"
    STRIPE_MODE="test"
    LOCAL_ENV="${ISKRA_STAGING_ENV_FILE:-server/.env}"
    ;;
  *)
    echo "Usage: $0 {staging|production} [--seed|--logs|--prepare]" >&2
    echo "Use ./deploy-staging.sh or ./deploy-production.sh to avoid selecting the wrong environment." >&2
    exit 2
    ;;
esac

HOST="${ISKRA_HOST:-root@2.25.93.183}"
CADDY_DIR="${ISKRA_CADDY_DIR:-/root/home/orvadora}"
KEY="${ISKRA_KEY:-$HOME/.ssh/iskra_deploy}"
REMOTE_ENV="server/.env.runtime"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -f "$KEY" ]] && SSH_OPTS+=(-i "$KEY")

say(){ printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
remote(){ ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }
env_value(){ sed -n "s/^$1=//p" "$LOCAL_ENV" | tail -1; }
require_prefix(){
  local key="$1" prefix="$2" value
  value="$(env_value "$key")"
  [[ "$value" == "$prefix"* ]] || { echo "$LOCAL_ENV must contain $key with a $prefix value" >&2; exit 1; }
}
require_min_length(){
  local key="$1" minimum="$2" value
  value="$(env_value "$key")"
  [[ ${#value} -ge $minimum ]] || { echo "$LOCAL_ENV must contain $key with at least $minimum characters" >&2; exit 1; }
}
require_database_uri(){
  local preferred="$1"
  [[ -n "$(env_value "$preferred")" || -n "$(env_value MONGODB_URI)" ]] || {
    echo "$LOCAL_ENV must contain $preferred or MONGODB_URI" >&2
    exit 1
  }
}

if [[ "${1:-}" == "--logs" ]]; then
  remote "docker logs -f --tail=100 $CONTAINER"
  exit 0
fi
PREPARE=false
[[ "${1:-}" == "--prepare" ]] && PREPARE=true
[[ $# -eq 0 || ( $# -eq 1 && ( "$1" == "--seed" || "$1" == "--prepare" ) ) ]] || { echo "Unknown option: ${1:-}" >&2; exit 2; }
[[ "$PREPARE" == false || "$ENVIRONMENT" == production ]] || { echo "--prepare is only needed for production before DNS cutover" >&2; exit 2; }

[[ -f "$LOCAL_ENV" ]] || { echo "$LOCAL_ENV is missing" >&2; exit 1; }
require_min_length JWT_SECRET 32
require_min_length SCANNER_SECRET 32
require_min_length VISITOR_SIGNING_SECRET 32
if [[ -n "$(env_value SCANNER_PASSCODE)" ]]; then
  require_min_length SCANNER_PASSCODE 8
fi
if [[ "$ENVIRONMENT" == production ]]; then
  require_database_uri MONGODB_URI_live
  if grep -q '^STRIPE_SECRET_KEY_live=' "$LOCAL_ENV"; then
    require_prefix STRIPE_SECRET_KEY_live sk_live_
    require_prefix STRIPE_PUBLISHABLE_KEY_live pk_live_
    require_prefix STRIPE_WEBHOOK_SECRET_live whsec_
  else
    require_prefix STRIPE_SECRET_KEY sk_live_
    require_prefix STRIPE_PUBLISHABLE_KEY pk_live_
    require_prefix STRIPE_WEBHOOK_SECRET whsec_
  fi
else
  require_database_uri MONGODB_URI_staging
  if grep -q '^STRIPE_SECRET_KEY_test=' "$LOCAL_ENV"; then
    require_prefix STRIPE_SECRET_KEY_test sk_test_
    require_prefix STRIPE_PUBLISHABLE_KEY_test pk_test_
  else
    require_prefix STRIPE_SECRET_KEY sk_test_
    require_prefix STRIPE_PUBLISHABLE_KEY pk_test_
  fi
fi

say "Deploying $ENVIRONMENT to $DOMAIN on $HOST"
remote "echo '  host:' \$(hostname); docker --version | sed 's/^/  /'; mkdir -p $DIR/server"

say "Uploading application to $DIR"
rsync -az --delete --delete-excluded -e "ssh ${SSH_OPTS[*]}" \
  --exclude '/.git/***' --exclude '**/node_modules/***' --exclude '**/dist/***' \
  --exclude 'server/.env*' --exclude '*.log' --exclude '.DS_Store' \
  --include '/client/***' --include '/server/***' --include '/shared/***' \
  --include '/Dockerfile' --include '/docker-compose.yml' \
  --include '/package.json' --include '/package-lock.json' --exclude '*' \
  ./ "$HOST:$DIR/"
rsync -az -e "ssh ${SSH_OPTS[*]}" "$LOCAL_ENV" "$HOST:$DIR/$REMOTE_ENV"

say "Building isolated $ENVIRONMENT container"
remote "cd $DIR && \
  COMPOSE_PROJECT_NAME=$PROJECT \
  ISKRA_IMAGE=$IMAGE \
  ISKRA_CONTAINER_NAME=$CONTAINER \
  ISKRA_ENV_FILE=./$REMOTE_ENV \
  DEPLOY_ENV=$ENVIRONMENT \
  STRIPE_MODE=$STRIPE_MODE \
  CLIENT_ORIGIN=https://$DOMAIN \
  docker compose up -d --build --remove-orphans"

say "Waiting for $CONTAINER to become healthy"
remote "for i in \$(seq 1 40); do
  s=\$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER 2>/dev/null || echo starting)
  [ \"\$s\" = healthy ] && { echo '  app: healthy'; exit 0; }
  [ \$i -eq 40 ] && { echo \"  app never became healthy (last: \$s)\"; docker logs --tail=50 $CONTAINER; exit 1; }
  sleep 2
done"

say "Publishing $DOMAIN_LIST through the shared Caddy"
remote "python3 - '$CADDY_DIR/Caddyfile' '$ENVIRONMENT' '$DOMAIN' '$CONTAINER' <<'PY'
import pathlib,re,sys
path=pathlib.Path(sys.argv[1]); env,domain,container=sys.argv[2:]
text=path.read_text()
begin=f'# BEGIN ISKRA {env}'
end=f'# END ISKRA {env}'
canonical=f'''{domain} {{
    encode zstd gzip
    @assets path /assets/*
    header @assets Cache-Control \"public, max-age=31536000, immutable\"
    header {{
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }}
    reverse_proxy {container}:4310
}}'''
alias=f'''www.{domain} {{
    redir https://{domain}{{uri}} permanent
}}\n''' if env == 'production' else ''
block=f'''{begin}
{alias}{canonical}
{end}'''
marked=re.compile(rf'(?ms)^# BEGIN ISKRA {re.escape(env)}$.*?^# END ISKRA {re.escape(env)}$')
if marked.search(text):
    text=marked.sub(block,text)
elif env == 'staging':
    legacy=re.compile(r'(?ms)^iskra\.orvadora\.com\s*\{.*?^\}')
    text=legacy.sub(block,text,1) if legacy.search(text) else text.rstrip()+'\n\n'+block+'\n'
else:
    text=text.rstrip()+'\n\n'+block+'\n'
backup=path.with_name(path.name+'.bak.iskra-'+env)
backup.write_text(path.read_text())
path.write_text(text)
PY
cd $CADDY_DIR
docker run --rm -e ACME_EMAIL=\${ACME_EMAIL:-hello@orvadora.com} \
  -v $CADDY_DIR/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2.10-alpine \
  caddy validate --config /etc/caddy/Caddyfile >/dev/null
docker compose up -d --force-recreate caddy >/dev/null
echo '  caddy updated and recreated'"

if [[ "${1:-}" == "--seed" ]]; then
  say "Seeding $ENVIRONMENT database"
  remote "docker exec $CONTAINER node server/src/seed.js"
fi

if [[ "$PREPARE" == true ]]; then
  say "Verifying prepared production container before DNS cutover"
  remote "docker exec $CONTAINER wget -qO- http://127.0.0.1:4310/api/health | grep -q '\"environment\":\"production\"'"
  say "Production origin prepared. Update Cloudflare DNS, then run ./deploy-production.sh"
  exit 0
fi

say "Checking https://$DOMAIN/api/health"
remote "code=\$(curl -s -o /tmp/iskra-health.json -w '%{http_code}' --max-time 30 https://$DOMAIN/api/health); cat /tmp/iskra-health.json; echo; [ \"\$code\" = 200 ] && grep -q '\"environment\":\"$ENVIRONMENT\"' /tmp/iskra-health.json"
say "$ENVIRONMENT deployment complete: https://$DOMAIN"
