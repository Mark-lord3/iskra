# ISKRA dating production deployment

## What is already deployed

The Hostinger VPS runs two isolated containers on the shared `orvadora_app`
Docker network:

- `iskra-dating-web` serves the browser application.
- `iskra-dating-api` serves `/api/v1`, Socket.IO, Stripe access, profiles,
  matches, compass sessions, and King & Queen voting.

Production uses the separate `iskra_dating_production` MongoDB database and a
persistent `/root/home/iskra-dating-production/dating-uploads` media directory.
The dating API reads its activation state from the production promo container,
not staging.

## Cloudflare DNS

GoDaddy is only the registrar. `project-iskra.com` uses the Cloudflare
nameservers `amit.ns.cloudflare.com` and `dawn.ns.cloudflare.com`, so do not
change DNS records in GoDaddy.

In Cloudflare:

1. Open **Websites** and select `project-iskra.com`.
2. Open **DNS** and then **Records**.
3. Select **Add record**.
4. Set **Type** to `A`.
5. Set **Name** to `dating`.
6. Set **IPv4 address** to `2.25.93.183`.
7. Set **Proxy status** to **DNS only** (grey cloud) for initial HTTPS issuance.
8. Set **TTL** to `Auto` and save.
9. Remove any conflicting `A`, `AAAA`, or `CNAME` record named `dating`.

Do not add a GoDaddy hostname, URL forwarding rule, Worker route, Pages custom
domain, or Cloudflare Tunnel record for this subdomain.

Wait until this prints `2.25.93.183`:

```bash
dig +short dating.project-iskra.com A
```

Caddy is already configured and will automatically obtain the TLS certificate
after DNS resolves. Run:

```bash
cd /Users/mark/Documents/promotion_for_iskra/iskra-app
./verify-production.sh
```

After verification passes, Cloudflare proxying may be enabled (orange cloud).
If enabled, set **SSL/TLS > Overview** to **Full (strict)**, never Flexible.
Cloudflare WebSockets must remain enabled. Do not create cache-everything rules
for `/api/v1/*` or `/socket.io/*`.

## Stripe live webhook

The live checkout key is selected automatically from `server/.env`. The dating
app needs its own webhook signing secret because Stripe signing secrets are
specific to each endpoint.

1. Open the Stripe dashboard in **Live mode**.
2. Open **Developers > Webhooks** and add an endpoint.
3. Use `https://dating.project-iskra.com/api/v1/access/webhook`.
4. Subscribe to `checkout.session.completed`.
5. Reveal the new `whsec_...` signing secret.
6. Add it to `server/.env` as:

```dotenv
STRIPE_DATING_WEBHOOK_SECRET_live=whsec_REPLACE_WITH_THE_NEW_SECRET
```

Redeploy and verify:

```bash
cd /Users/mark/Documents/promotion_for_iskra/iskra-app
./deploy-production.sh
./verify-production.sh
```

The verification output must show both Stripe checkout and Stripe webhook as
configured.

## Admin activation

Open `https://project-iskra.com/admin#dating` and use the two production
controls:

- **Dating event is open** controls registration, the $5 event pass, profiles,
  discovery, matching, groups, and compass mode.
- **King & Queen voting is open** controls selfie voting and is disabled
  automatically whenever the dating event is closed.

The dating browser checks production controls every five seconds. The API also
checks controls server-side and fails closed if the promo API is unavailable.

## Deployment scripts

### Dating staging

```bash
cd /Users/mark/Documents/promotion_for_iskra
npm run deploy:dating:staging
```

This publishes `dating.orvadora.com` using test Stripe credentials, the
`iskra_dating_staging` database, staging-only media storage and containers, and
the promo controls served by `iskra-staging`. It does not modify dating
production. To verify it without deploying, run:

```bash
cd /Users/mark/Documents/promotion_for_iskra/iskra-app
./verify-staging.sh
```

### Dating production

```bash
cd /Users/mark/Documents/promotion_for_iskra/iskra-app
./deploy-production.sh
```

This builds both dating images, preserves production JWT and QR secrets,
uploads code without deleting event media, starts the isolated containers,
synchronizes the current event from the production schedule, updates Caddy,
and checks the production feature controls.

### Dating verification

```bash
cd /Users/mark/Documents/promotion_for_iskra/iskra-app
./verify-production.sh
```

### Main promo production

```bash
cd /Users/mark/Documents/promotion_for_iskra
./deploy-production.sh
```

Use `./deploy-production.sh --seed` only when production seed updates are
intended.

### Main promo staging

```bash
cd /Users/mark/Documents/promotion_for_iskra
./deploy-staging.sh
```

### Logs

```bash
cd /Users/mark/Documents/promotion_for_iskra
./deploy.sh production --logs
```

```bash
ssh -i ~/.ssh/iskra_deploy root@2.25.93.183 \
  "docker logs -f --tail=100 iskra-dating-api"
```

```bash
ssh -i ~/.ssh/iskra_deploy root@2.25.93.183 \
  "docker logs -f --tail=100 iskra-dating-web"
```

## Deployment files

- `deploy-production.sh`: dating production orchestration.
- `verify-production.sh`: public DNS, HTTPS, API, Stripe, and activation checks.
- `docker-compose.production.yml`: isolated production containers, health
  checks, network, and persistent upload mount.
- `scripts/build-production-env.mjs`: builds the runtime environment without
  printing secrets and keeps production signing secrets stable across deploys.
- `apps/api/Dockerfile`: production API and event-sync seed image.
- `apps/web/Dockerfile`: production web build using same-origin `/api/v1`.
