#!/bin/sh
# Entrypoint for the customereq-migrate ACA Job (issue #386).
# Runs prisma migrate deploy then asserts _prisma_migrations completeness.
# Exits non-zero on any failure so the ACA Job run fails and deploy is blocked.
# Does NOT start the API server — migration only.
set -e

echo "=== CustomerEQ: database migration ==="

cd /app/packages/database
PRISMA="./node_modules/.bin/prisma"

echo "Running prisma migrate deploy..."
$PRISMA migrate deploy

echo "Verifying _prisma_migrations completeness..."
node /app/packages/database/scripts/verify-migrations.mjs

echo "=== Migration succeeded ==="
