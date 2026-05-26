#!/usr/bin/env bash
# Run locally with:
# ENV=local ./scripts/reset_all_tables.sh
set -euo pipefail

if [[ "${ENV:-}" != "local" ]]; then
  echo "Refusing to run reset_all.sh — ENV must be set to 'local'"
  exit 1
fi

echo
echo "⚠️  WARNING: FULL DATABASE RESET"
echo "--------------------------------"
echo "This will reset and reschema all pipeline-managed tables — fars crashes+persons, cities, and stats."
echo "This action is IRREVERSIBLE."
echo

read -p "Type RESET to continue: " CONFIRM
if [[ "$CONFIRM" != "RESET" ]]; then
  echo "Reset aborted."
  exit 1
fi

SKIP_CONFIRM=true ENV=local ./scripts/reset_fars_tables.sh
SKIP_CONFIRM=true ENV=local ./scripts/reset_city_tables.sh