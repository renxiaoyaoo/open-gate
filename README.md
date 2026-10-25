# OpenHome

OpenHome is a self-hosted home-control hub. Its shared Web and API foundation hosts focused modules: OpenGate for access control and OpenDevice for smart appliances.

The public project is provider-neutral: upstream endpoints, credentials, signing material, deployment domains, user data, and captured artifacts are never committed.

## Modules

- **OpenGate**: multiple access-provider accounts, aggregated doors, remote opening, and temporary access codes
- **OpenDevice**: authorized smart-appliance accounts and device controls; dryer status, programs, operation, and appointments are currently implemented

## Shared foundation

- Shared encrypted login state across devices
- Aggregated doors without exposing account-to-door relationships
- Opaque public identifiers and idempotent open requests
- Large, mobile-first door controls
- Cloudflare Workers + D1 deployment
- Standard Node.js + local SQLite deployment
- External authentication friendly; application authentication is intentionally pluggable

## Run with Node.js

```sh
cd web
cp .env.example .env.local
npm ci
npm run build:node
npm run start:node
```

Node.js 22.13 or newer is required. Local state is stored in `web/data/open-gate.sqlite` by default.

## Cloudflare

Cloudflare is an optional adapter, not a core requirement. See [`deploy/cloudflare`](deploy/cloudflare) for the D1/Workers template. Deployment domains and Cloudflare account identifiers belong in private, ignored configuration.

See [architecture](web/docs/central-architecture.md), [OpenAPI](web/docs/openapi.yaml), [deployment guide](docs/deployment.md), and [repository boundaries](docs/repository-layout.md).
