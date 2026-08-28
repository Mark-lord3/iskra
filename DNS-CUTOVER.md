# project-iskra.com production cutover

GoDaddy is only the registrar. The active authoritative nameservers are Cloudflare
(`amit.ns.cloudflare.com` and `dawn.ns.cloudflare.com`), so DNS changes belong in the
Cloudflare dashboard.

## Cloudflare DNS

Remove or replace any existing Cloudflare Pages custom domain or Worker route that currently
serves `project-iskra.com`, then configure:

| Type | Name | Target | Proxy |
|---|---|---|---|
| A | `@` | `2.25.93.183` | DNS only initially |
| CNAME | `www` | `project-iskra.com` | DNS only initially |

Remove conflicting `AAAA`, `A`, or `CNAME` records for the same hostnames. Start with DNS
only so Caddy can complete its ACME certificate challenge. After
`https://project-iskra.com/api/health` reports `"environment":"production"`, the records
may be switched to Proxied and Cloudflare SSL/TLS should be set to Full (strict).

## Complete deployment

```bash
./deploy-production.sh
```

The command refuses test Stripe keys and verifies that the public domain is returning the
production environment.

## Stripe live webhook

Create a live-mode Stripe webhook endpoint at:

```text
https://project-iskra.com/api/tickets/webhook
```

Subscribe it to checkout completion/expiration and subscription lifecycle events. Put that
endpoint's own `whsec_...` value in `STRIPE_WEBHOOK_SECRET_live`; webhook signing secrets
are endpoint-specific. Redeploy production after changing it.
