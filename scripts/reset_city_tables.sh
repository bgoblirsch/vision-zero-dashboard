#!/usr/bin/env bash
# Run locally with:
# ENV=local ./scripts/reset_city_tables.sh
set -euo pipefail

if [[ "${ENV:-}" != "local" ]]; then
  echo "Refusing to run reset_city_tables.sh"
  echo "ENV must be set to 'local'"
  echo
  echo "Example:"
  echo "  ENV=local ./reset_city_tables.sh"
  exit 1
fi

echo
echo " ⚠️  WARNING: CITY TABLES RESET"
echo "-------------------------------"
echo "This will:"
echo "  - DROP the city tables"
echo "  - DELETE all ingested city data"
echo "  - Reschema the city tables."
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

psql -U visionzero -d visionzero_db -f schema/drop_city_tables.sql
psql -U visionzero -d visionzero_db -f schema/census_places.sql
psql -U visionzero -d visionzero_db -f schema/city_stats.sql
