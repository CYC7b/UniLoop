#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to manage backend services." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Install Docker Desktop, OrbStack, or the Docker Compose plugin." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created backend/.env from backend/.env.example"
fi

exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
