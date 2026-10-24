# Deployment

## Node.js and SQLite

Node.js is the portable default and requires no Cloudflare services. Configure `.env.local`, run `npm run build:node`, then `npm run start:node`. Persist the directory containing `OPENGATE_DATABASE_PATH` and terminate TLS at a reverse proxy.

## Docker

Build from `deploy/docker/Dockerfile`, mount `/app/web/data`, and pass configuration as environment variables or secrets. The image runs the standard Next.js server and local SQLite.

## Cloudflare Workers and D1

The Cloudflare adapter is optional. Set `OPENGATE_CF_DATABASE_ID` and optionally `OPENGATE_CF_DATABASE_NAME`, `OPENGATE_CF_CUSTOM_DOMAIN`, and `OPENGATE_API_ENABLED=1` in the private deployment environment, configure Worker secrets, then run `npm run cf:deploy` from `web`. The generated `web/wrangler.production.jsonc` is ignored. No account ID, database UUID, custom domain, or secret belongs in this repository.

To sync an ignored private environment file through a deployment host without retaining a remote plaintext copy, run `deploy/cloudflare/sync-via-ssh.sh <ssh-target> <remote-repo-root> [private-env-file]`. The remote temporary file is removed automatically after Wrangler updates the Worker secrets.
