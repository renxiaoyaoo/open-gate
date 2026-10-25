# OpenHome Web

OpenHome is a small home-control hub. It currently brings together two independent features:

- **OpenGate** for access control
- **Dryer** for live status, program selection, operation, and appointments

The feature switcher is part of the product shell; OpenGate remains a distinct module rather than the name of the whole site.

The application can run in two modes:

- Node.js 22.13+ with the built-in SQLite driver and `OPENGATE_DATABASE_PATH`
- Cloudflare Workers with a D1 binding named `DB`

All provider-specific values are runtime configuration. Copy `.env.example`, supply the private access-control and dryer adapter configuration, and never commit real endpoints, credentials, sessions, or signing material.

```sh
npm ci
npm test
npm run lint
npm run build:node
npm run start:node
```

For Cloudflare, use `npm run build` and the template under `../deploy/cloudflare`. Both runtimes expose the same `/api/v1` contract. The scripts call Next.js and Vinext directly; no machine-specific bootstrap or hosted-preview wrapper is required.
