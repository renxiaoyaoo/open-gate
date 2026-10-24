# OpenGate Web / OpenAPI

The application can run in two modes:

- Node.js 22.13+ with the built-in SQLite driver and `OPENGATE_DATABASE_PATH`
- Cloudflare Workers with a D1 binding named `DB`

All provider-specific values are runtime configuration. Copy `.env.example`, supply a private provider adapter configuration, and never commit real endpoints or signing material.

```sh
npm ci
npm test
npm run lint
npm run build:node
npm run start:node
```

For Cloudflare, use `npm run build` and the template under `../deploy/cloudflare`. Both runtimes expose the same `/api/v1` contract.
