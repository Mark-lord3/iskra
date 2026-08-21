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

