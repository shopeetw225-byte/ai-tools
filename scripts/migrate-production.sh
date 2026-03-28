#!/usr/bin/env bash
# Run all D1 migrations against the production database.
# Prerequisites: wrangler CLI authenticated with CLOUDFLARE_API_TOKEN.
#
# Usage:
#   cd apps/api
#   bash ../../scripts/migrate-production.sh

set -euo pipefail

DB_NAME="catfish-ai-tools-db"
MIGRATION_DIR="../../db/migrations"

for f in "$MIGRATION_DIR"/0*.sql; do
  echo "▶ Applying $(basename "$f") ..."
  npx wrangler d1 execute "$DB_NAME" --file="$f" --remote
  echo "  ✓ done"
done

echo ""
echo "All migrations applied successfully."
