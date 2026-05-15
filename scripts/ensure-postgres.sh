#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

exec sh "$ROOT_DIR/scripts/ensure-compose-services.sh" db
