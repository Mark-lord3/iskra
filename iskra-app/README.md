# Iskra App

Separate production-oriented project scaffold for the venue-based dating and social discovery product.

## Stack

- React + TypeScript + Vite
- Tailwind CSS + Framer Motion
- Zustand + TanStack Query
- Node.js + TypeScript + Express
- MongoDB + Mongoose
- Socket.IO
- Stripe-ready payment service stub
- Local ephemeral event media storage with cleanup worker

## Structure

```text
iskra-app/
  apps/
    web/   mobile-first frontend
    api/   REST API, sockets, cleanup worker, media service
```

## Run

```bash
cd iskra-app
npm install
npm run dev
```

Frontend runs on `http://localhost:5174`.
API runs on `http://localhost:4311`.

## Important architecture note

This project intentionally uses **server-local event media storage** instead of Cloudinary/S3 because the product brief requires uploaded venue media to expire and be deleted automatically after event cleanup.

Use a mounted host volume in production:

```yaml
volumes:
  - ./uploads:/app/uploads
```

## Production deployment

`deploy-production.sh` deploys isolated web and API containers on the shared
Hostinger VPS and publishes them through Caddy at
`https://dating.project-iskra.com`.

```bash
cd iskra-app
./deploy-production.sh
```

Production uses the separate `iskra_dating_production` database and reads the
dating and King & Queen switches from the production promo API. Clients poll
those controls every five seconds, and the active dating event synchronizes
from the production schedule.

Cloudflare must contain this DNS record before Caddy can issue HTTPS:

| Type | Name | Target | Proxy |
|---|---|---|---|
| A | `dating` | `2.25.93.183` | DNS only until HTTPS works |

For reliable asynchronous Stripe confirmation, create a separate live webhook
at `https://dating.project-iskra.com/api/v1/access/webhook`, subscribe it to
`checkout.session.completed`, and store its signing secret as
`STRIPE_DATING_WEBHOOK_SECRET_live` in `server/.env` before redeploying.

## Staging deployment

Dating staging is isolated at `https://dating.orvadora.com`. It uses separate
containers, uploads, signing secrets, the `iskra_dating_staging` database, test
Stripe keys, and activation controls from `https://iskra.orvadora.com`.

```bash
cd /Users/mark/Documents/promotion_for_iskra
npm run deploy:dating:staging
npm run verify:staging --prefix iskra-app
```

If test webhooks are required, create a Stripe **test mode** endpoint at
`https://dating.orvadora.com/api/v1/access/webhook`, subscribe to
`checkout.session.completed`, and add its secret to `server/.env` as
`STRIPE_DATING_WEBHOOK_SECRET_staging`.
