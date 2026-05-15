#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

echo "Stopping backend Docker services."
exec sh "$ROOT_DIR/scripts/backend-compose.sh" stop
