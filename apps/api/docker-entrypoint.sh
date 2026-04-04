#!/bin/sh
# Entrypoint: apply DB migrations then start API server.
# Uses project-pinned Prisma 5.x (not npx which fetches Prisma 7).
# Handles baseline state where existing migrations may already be applied
# to the database but not tracked in _prisma_migrations.

set -e

cd /app/packages/database
PRISMA="./node_modules/.bin/prisma"

# Mark any already-applied existing migrations as "applied" to recover from
# any prior failed-state (e.g. if a previous Prisma version ran and errored).
# These commands are idempotent: they succeed whether or not the migration
# is currently tracked, failed, or already marked applied.
for mig in \
  20260327085710_m1_configure_loyalty_program \
  20260401000000_add_member_opt_in_and_program_slug \
  20260403000000_add_kb_articles
do
  $PRISMA migrate resolve --applied "$mig" 2>/dev/null || true
done

# Now apply any pending new migrations.
$PRISMA migrate deploy

cd /app
exec node apps/api/dist/server.js
