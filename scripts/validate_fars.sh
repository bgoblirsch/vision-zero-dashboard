psql -U visionzero -d visionzero_db -f schema/validation/fars_diagnostics.sql
psql -U visionzero -d visionzero_db -v ON_ERROR_STOP=1 -f schema/validation/fars_blocking_checks.sql
