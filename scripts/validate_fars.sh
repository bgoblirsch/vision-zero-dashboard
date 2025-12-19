psql -f fars_info_checks.sql
psql -v ON_ERROR_STOP=1 -f fars_blocking_checks.sql