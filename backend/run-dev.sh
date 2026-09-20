#!/usr/bin/env bash
# Starts the backend with JWT_SECRET and ANTHROPIC_API_KEY loaded from backend/.env (gitignored).
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo "Missing backend/.env - create it with JWT_SECRET=... and ANTHROPIC_API_KEY=..." >&2
  exit 1
fi
set -a
source .env
set +a
exec ./mvnw spring-boot:run
