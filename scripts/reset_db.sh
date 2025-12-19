#!/usr/bin/env bash
# Run locally with:
# ENV=local ./scripts/reset_db.sh
set -euo pipefail

if [[ "${ENV:-}" != "local" ]]; then
  echo "Refusing to run reset_db.sh"
  echo "ENV must be set to 'local'"
  echo
  echo "Example:"
  echo "  ENV=local ./reset_db.sh"
  exit 1
fi

echo
echo " ⚠️  WARNING: DATABASE RESET"
echo "-----------------------------"
echo "This will:"
echo "  - DROP the accidents tabl"
echo "  - DELETE all ingested FARS data"
echo
echo "This action is IRREVERSIBLE."
echo

read -p "Type RESET to continue: " CONFIRM

if [[ "$CONFIRM" != "RESET" ]]; then
  echo
  echo "Reset aborted."
  exit 1
fi

psql -U visionzero -d visionzero_db -f schema/drop_accidents.sql
psql -U visionzero -d visionzero_db -f schema/extensions.sql
psql -U visionzero -d visionzero_db -f schema/accidents.sql