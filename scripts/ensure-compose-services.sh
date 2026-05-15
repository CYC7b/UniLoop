#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ "$#" -eq 0 ]; then
  set -- nginx notification-service mailpit
fi

echo "Starting backend Docker services: $*"
exec sh "$ROOT_DIR/scripts/backend-compose.sh" up -d "$@"
