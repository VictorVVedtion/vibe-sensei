#!/bin/bash
cd "$(dirname "$0")/.."
npx concurrently \
  --names "vite,electron" \
  --prefix-colors "cyan,green" \
  "npx vite --config vite.config.ts" \
  "sleep 3 && npx electron ."
