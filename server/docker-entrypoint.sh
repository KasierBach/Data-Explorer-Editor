#!/bin/sh
# ──────────────────────────────────────────────
# Data Explorer – Backend Docker Entrypoint
# When using docker-compose, migrations are
# handled by the separate "migrate" service.
# This entrypoint starts the NestJS server.
# ──────────────────────────────────────────────
set -e

if [ "$#" -gt 0 ]; then
  echo "Running configured container command..."
  exec "$@"
fi

echo "🚀 Starting Data Explorer server..."
exec node dist/src/main.js
