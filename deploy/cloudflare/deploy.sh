#!/bin/sh
set -eu

deploy_root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
web_root=$(CDPATH= cd -- "$deploy_root/../../web" && pwd)
cd "$web_root"
node "$deploy_root/prepare-config.mjs"
npm test
npm run lint
npm run build
./node_modules/.bin/wrangler d1 migrations apply "${OPENGATE_CF_DATABASE_NAME:-open-gate}" --remote --config wrangler.production.jsonc
./node_modules/.bin/wrangler deploy --config wrangler.production.jsonc
