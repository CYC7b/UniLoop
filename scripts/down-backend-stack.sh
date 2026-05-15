#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

echo "Removing backend Docker containers and default network. Volumes are kept."
exec sh "$ROOT_DIR/scripts/backend-compose.sh" down
