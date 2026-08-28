#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${ISKRA_DATING_DOMAIN:-dating.project-iskra.com}"
EXPECTED_ORIGIN="${ISKRA_DATING_IP:-2.25.93.183}"

say(){ printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }

say "Checking DNS for $DOMAIN"
RESOLVED_IPS="$(dig +short "$DOMAIN" A | paste -sd ' ' -)"
if [[ -z "$RESOLVED_IPS" ]]; then
  echo "DNS is missing. Add an A record in Cloudflare: dating -> $EXPECTED_ORIGIN" >&2
  exit 1
fi
echo "  resolved: $RESOLVED_IPS"
if [[ " $RESOLVED_IPS " != *" $EXPECTED_ORIGIN "* ]]; then
  echo "  note: Cloudflare proxying may hide the origin IP; HTTPS checks will confirm routing."
fi

say "Checking the public web application"
curl --fail --silent --show-error --location --output /dev/null "https://$DOMAIN/"
echo "  homepage: reachable"

say "Checking the dating API"
HEALTH="$(curl --fail --silent --show-error "https://$DOMAIN/api/v1/health")"
CONFIG="$(curl --fail --silent --show-error "https://$DOMAIN/api/v1/config")"
node --input-type=module - "$HEALTH" "$CONFIG" <<'NODE'
const health = JSON.parse(process.argv[2]);
const config = JSON.parse(process.argv[3]);
if (!health.ok || health.service !== "iskra-api") process.exit(1);
console.log(`  API: healthy`);
console.log(`  Stripe checkout: ${health.integrations?.stripeCheckout ? "configured" : "missing"}`);
console.log(`  Stripe webhook: ${health.integrations?.stripeWebhook ? "configured" : "missing"}`);
console.log(`  Dating event: ${config.enabled ? "open" : "closed"}`);
console.log(`  King & Queen: ${config.competitionEnabled ? "open" : "closed"}`);
NODE

say "Production verification passed"
