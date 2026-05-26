#!/usr/bin/env bash
# Run locally with:
# ENV=local ./scripts/reset_fars_tables.sh
set -euo pipefail

if [[ "${ENV:-}" != "local" ]]; then
  echo "Refusing to run reset_fars_tables.sh"
  echo "ENV must be set to 'local'"
  echo
  echo "Example:"
  echo "  ENV=local ./reset_fars_tables.sh"
  exit 1
fi

echo
echo " ⚠️  WARNING: FARS TABLES RESET"
echo "-------------------------------"
echo "This will:"
echo "  - DROP the crashes table"
echo "  - DELETE all ingested FARS data"
echo "  - Reschema the crashes and persons tables."
echo
echo "This action is IRREVERSIBLE."
echo

SKIP_CONFIRM="${SKIP_CONFIRM:-false}"

if [[ "$SKIP_CONFIRM" != "true" ]]; then
    read -p "Type RESET to continue: " CONFIRM
    if [[ "$CONFIRM" != "RESET" ]]; then
        echo "Reset aborted."
        exit 1
    fi
fi

psql -U visionzero -d visionzero_db -f schema/drop_fars_tables.sql
psql -U visionzero -d visionzero_db -f schema/extensions.sql
psql -U visionzero -d visionzero_db -f schema/fars_crashes.sql
psql -U visionzero -d visionzero_db -f schema/fars_persons.sql
