# OpenHome project rules

Follow the user's global Codex workflow. Keep this public repository portable
and free of personal infrastructure, provider endpoints, credentials, sessions,
phone numbers, signing material, deployment domains, and captured artifacts.

## Development

- The application lives in `web/` and requires Node.js 22.13 or newer.
- Use the committed `web/package-lock.json`; install with `cd web && npm ci`.
- For every functional change, run from `web/`:
  `npm test`, `npm run lint`, and `npm run build:node`.
- For a meaningful UI change, also start the Node build, inspect runtime output,
  exercise the affected state in a browser, and capture a screenshot. Do not
  report completion for a UI change based only on a successful build.
- Do not commit `.env` files, local databases, provider responses, screenshots
  containing real data, or generated deployment configuration.
- Do not deploy to Cloudflare or another environment unless explicitly asked.
  Deployment must stop if tests, lint, or build fail.
