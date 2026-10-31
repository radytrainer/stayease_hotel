#!/usr/bin/env bash
# Writes a compressed PostgreSQL dump to ~/stayease-backups and keeps the newest 14.
# Daily at 02:00 via cron:  0 2 * * * bash /home/ubuntu/stayease/deploy/backup-db.sh
# Restore:  gunzip -c FILE.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U stayease stayease
set -euo pipefail
cd "$(dirname "$0")/.."
env_get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '\r'; }
user=$(env_get POSTGRES_USER); db=$(env_get POSTGRES_DB)

dir="$HOME/stayease-backups"
mkdir -p "$dir"
file="$dir/stayease-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${user:-stayease}" "${db:-stayease}" | gzip > "$file"
ls -1t "$dir"/stayease-*.sql.gz | tail -n +15 | xargs -r rm --
echo "Saved $file"
