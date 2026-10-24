#!/bin/sh
set -eu

target=${1:?"Usage: sync-via-ssh.sh <ssh-target> <remote-repo-root> [private-env-file]"}
remote_root=${2:?"Usage: sync-via-ssh.sh <ssh-target> <remote-repo-root> [private-env-file]"}
script_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
env_file=${3:-"$script_root/.env.deploy.local"}
remote_file="/tmp/open-gate-secrets-$$.env"

test -f "$env_file"
scp "$env_file" "$target:$remote_file"
ssh "$target" "set -eu; trap 'rm -f \"$remote_file\"' EXIT; cd '$remote_root/web'; node '$remote_root/deploy/cloudflare/sync-secrets.mjs' '$remote_file' wrangler.production.jsonc"
