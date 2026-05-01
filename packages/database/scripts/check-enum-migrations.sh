#!/usr/bin/env bash
# Verifies that every enum declared in schema.prisma has a corresponding
# CREATE TYPE statement in at least one migration file.
#
# Catches the class of bug that caused the 2026-04-27 production outage:
# SurveyType existed in schema.prisma but was never created by a migration,
# causing a PG 42704 error mid-deploy and a partial schema commit.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCHEMA="$REPO_ROOT/packages/database/prisma/schema.prisma"
MIGRATIONS_DIR="$REPO_ROOT/packages/database/prisma/migrations"

missing=()
all_enums=()

while IFS= read -r enum; do
  all_enums+=("$enum")
  if ! grep -rq "CREATE TYPE \"${enum}\"" "$MIGRATIONS_DIR"; then
    missing+=("$enum")
  fi
done < <(grep '^enum ' "$SCHEMA" | awk '{print $2}')

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: The following enums in schema.prisma have no CREATE TYPE in any migration:"
  printf '  - %s\n' "${missing[@]}"
  echo ""
  echo "Add a migration that creates these types before merging."
  echo "See the 2026-04-27 incident (migration 20260427200452) for context."
  exit 1
fi

echo "OK: all ${#all_enums[@]} enums have a corresponding CREATE TYPE migration."
