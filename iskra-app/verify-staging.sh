#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${ISKRA_DATING_STAGING_DOMAIN:-dating.orvadora.com}"

say(){ printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }

say "Checking DNS for $DOMAIN"
RESOLVED_IPS="$(dig +short "$DOMAIN" A | paste -sd ' ' -)"
[[ -n "$RESOLVED_IPS" ]] || { echo "DNS is missing for $DOMAIN" >&2; exit 1; }
echo "  resolved: $RESOLVED_IPS"

say "Checking the public staging web application"
curl --fail --silent --show-error --location --output /dev/null "https://$DOMAIN/"
echo "  homepage: reachable"

say "Checking the staging dating API"
HEALTH="$(curl --fail --silent --show-error "https://$DOMAIN/api/v1/health")"
CONFIG="$(curl --fail --silent --show-error "https://$DOMAIN/api/v1/config")"
node --input-type=module - "$HEALTH" "$CONFIG" <<'NODE'
const health = JSON.parse(process.argv[2]);
const config = JSON.parse(process.argv[3]);
if (!health.ok || health.service !== "iskra-api") process.exit(1);
console.log("  API: healthy");
console.log(`  Stripe test checkout: ${health.integrations?.stripeCheckout ? "configured" : "missing"}`);
console.log(`  Stripe test webhook: ${health.integrations?.stripeWebhook ? "configured" : "missing"}`);
console.log(`  Dating event: ${config.enabled ? "open" : "closed"}`);
console.log(`  King & Queen: ${config.competitionEnabled ? "open" : "closed"}`);
NODE

say "Staging verification passed"
