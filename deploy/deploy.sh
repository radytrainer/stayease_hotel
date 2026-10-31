#!/usr/bin/env bash
# Builds and (re)starts the production stack, then waits until the site answers.
# Run from anywhere on the server:  bash deploy/deploy.sh   (add --pull to fetch the latest code first)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env. Create it with: cp deploy/env.production.example .env  and fill it in." >&2
  exit 1
fi
env_get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '\r'; }
PUBLIC_URL=$(env_get PUBLIC_URL)
if [ -z "$(env_get POSTGRES_PASSWORD)" ] || [ -z "$PUBLIC_URL" ]; then
  echo "Set POSTGRES_PASSWORD and PUBLIC_URL in .env first." >&2
  exit 1
fi

if [ "${1:-}" = "--pull" ]; then git pull --ff-only; fi

compose="docker compose -f docker-compose.prod.yml"
$compose up -d --build --remove-orphans

echo "Waiting for ${PUBLIC_URL} ..."
for _ in $(seq 1 60); do
  if curl -fsS http://localhost/api/v1/health >/dev/null 2>&1 && curl -fsS -o /dev/null http://localhost/; then
    $compose ps
    docker image prune -f >/dev/null
    echo "StayEase is up at ${PUBLIC_URL}"
    exit 0
  fi
  sleep 5
done

echo "The site did not come up within 5 minutes. Recent logs:" >&2
$compose logs --tail=80 api web proxy >&2
exit 1
