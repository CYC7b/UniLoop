.PHONY: run build migrate tidy db-up

ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/..)
POSTGRES_SCRIPT := $(ROOT_DIR)/scripts/ensure-postgres.sh

db-up:
	$(POSTGRES_SCRIPT)

run: db-up
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

migrate:
	psql "$(DATABASE_URL)" -f migrations/001_init.sql

tidy:
	go mod tidy

.env:
	cp .env.example .env
