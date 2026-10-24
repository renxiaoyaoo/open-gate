# Deployment

## Node.js and SQLite

Node.js is the portable default and requires no Cloudflare services. Configure `.env.local`, run `npm run build:node`, then `npm run start:node`. Persist the directory containing `OPENGATE_DATABASE_PATH` and terminate TLS at a reverse proxy.

## Docker

Build from `deploy/docker/Dockerfile`, mount `/app/web/data`, and pass configuration as environment variables or secrets. The image runs the standard Next.js server and local SQLite.

## Cloudflare Workers and D1

The Cloudflare adapter is optional. Copy `deploy/cloudflare/wrangler.template.jsonc` to a private deployment configuration, replace placeholders, configure Worker secrets, apply the migrations, and deploy. No account ID, database UUID, custom domain, or secret belongs in this repository.
