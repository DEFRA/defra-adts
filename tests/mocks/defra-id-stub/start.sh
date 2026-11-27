#!/usr/bin/env bash
# Runs DEFRA's CDP Defra ID stub (https://github.com/DEFRA/cdp-defra-id-stub) locally
# on port 3400 (3200 is the ADTS backend). Needs Node >= 24 and git.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
cache_dir="$here/.cache/cdp-defra-id-stub"

if [ ! -d "$cache_dir" ]; then
  git clone --depth 1 https://github.com/DEFRA/cdp-defra-id-stub.git "$cache_dir"
  (cd "$cache_dir" && npm install && npm run build)
fi

node "$here/patch-stub.mjs" "$cache_dir"

cd "$cache_dir"
PORT="${STUB_PORT:-3400}" \
  APP_BASE_URL="http://localhost:${STUB_PORT:-3400}" \
  NODE_ENV=development \
  REGISTRATIONS_STORE_ENGINE=memory \
  USE_SINGLE_INSTANCE_CACHE=true \
  LOCAL_OIDC_USE_GET_CALLBACK=true \
  node .
