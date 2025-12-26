# Vision Zero Dashboard

A data engineering project that ingests, normalizes, and analyzes U.S. traffic-fatality data in support of Vision Zero–style safety analysis for large cities.

This repository currently focuses on building a reliable, historically aware ETL pipeline for the Fatality Analysis Reporting System (FARS), with the goal of enabling downstream spatial analysis, dashboards, and policy-relevant metrics.

---

## Tech Stack

**Languages**
- Python 3.12

**Data Engineering**
- Python (streaming CSV ingestion, year-aware ETL)
- psycopg (PostgreSQL driver)
- tqdm (download and load progress)

**Database**
- PostgreSQL with PostGIS
- Spatial indexes (GiST) on geometry columns

**Geospatial**
- PostGIS geometry types (SRID 4326)
- Coordinate normalization across historical FARS formats

**Infrastructure / Tooling**
- Docker (planned)
- Git + GitHub

---

## Data Sources

- [FARS - Fatality Analysis Reporting System](https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars)
    - Nationwide annual fatality data with a ~2 year lag.
- State level public data portals. eg. https://gisdata.mn.gov/
    - less lag than FARS

## Project Goals

- Build a **robust, idempotent ETL pipeline** for multi-decade FARS data (1987–present)
- Normalize historical schema changes across FARS releases
- Store cleaned data in PostgreSQL with PostGIS for spatial analysis (geometry columns, SRID 4326)
- Support city-level safety analysis (initial scope: U.S. cities >100k population)
- Serve as the backend data layer for a future analytics dashboard

---

## Current Status

**Implemented**
- Automated download and extraction of FARS datasets by year
- Idempotent ingestion into PostGIS with conflict handling
- Handling of historical inconsistencies:
  - Missing or partial dates
  - Encoding issues (BOM, legacy encodings)
  - Pre-1999 lack of latitude/longitude
  - Coordinate format changes (DMS → decimal degrees)
- Structured logging with per-year and pipeline-level summaries

**In Progress / Planned**
- Validation queries and data quality checks
- City and county name normalization
- Person-level joins for fatality breakdowns
- Indexing and performance tuning
- API and visualization layer
- Ingest data at the city-level for the latest available data

---

## Pipeline Architecture

The pipeline is structured around a **decoupled Extract → Transform/Load (E→TL)** design to accommodate historical inconsistencies in FARS data while remaining idempotent and easy to re-run.

### Why Extract → Transform/Load (E→TL)?

- **Historical variability**  
  FARS data spans decades with evolving schemas, encodings, date formats, and coordinate representations. Performing lightweight, deterministic transformations at load time avoids maintaining dozens of version-specific transform pipelines.

- **Operational simplicity**  
  Transformations are tightly coupled to schema enforcement and conflict handling, which simplifies debugging and keeps the pipeline understandable end-to-end.

- **Database-first correctness**  
  Uniqueness, constraints, and conflict resolution are enforced in PostgreSQL/PostGIS, ensuring correctness even if the pipeline is interrupted or re-run.


### High-level flow

        ┌───────────────┐
        │   FARS Data   │
        │  (ZIP / CSV)  │
        └───────┬───────┘
                │
                ▼
    ┌─────────────────────────┐
    │        Extract          │
    │  - Download by year     │
    │  - Skip if exists       │
    │  - Extract once         │
    │  - Preserve raw files   │
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │  Transform (inline)     │
    │  - Schema normalization │
    │  - Date parsing         │
    │  - Coordinate handling  │
    │  - Encoding cleanup     │
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │           Load          │
    │  - Batch inserts        │
    │  - ON CONFLICT handling │
    │  - PostGIS geometry     │
    │  - Progress + metrics   │
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ PostgreSQL + PostGIS    │
    │  - Crashes table        │
    │  - Spatial indexes      │
    │  - Source of truth      │
    └─────────────────────────┘

1. **Extract**
   - Resolve target years (explicit CLI input or defaults).
   - Download annual FARS archives if not already present.
   - Extract CSV files once per year, with safeguards to avoid redundant work.
   - Preserve raw files on disk to support repeatable runs and debugging.

2. **Transform (inline during load)**
   - Normalize schema differences across decades of FARS releases.
   - Parse and standardize:
     - Dates (including partial or invalid historical dates)
     - Geographic coordinates (DMS → decimal degrees → PostGIS geometry)
     - Legacy encodings and column name variations
   - Apply minimal, deterministic transformations required for storage.

3. **Load**
   - Stream records into PostgreSQL with PostGIS.
   - Enforce idempotency via database constraints and `ON CONFLICT` handling.
   - Track per-year metrics (processed / inserted / skipped / errors).
   - Commit in batches to balance performance and safety.

### Design principles

- **Idempotent by default**  
  The pipeline can be safely re-run for any year without duplicating data.

- **Historically aware**  
  Parsing and normalization logic explicitly accounts for known structural changes in FARS over time rather than assuming a single stable schema.

- **Disk-backed extraction**  
  Raw source files are retained locally, enabling inspection, reprocessing, and future transformations without re-downloading upstream data.

- **Database as the source of truth**  
  PostgreSQL enforces uniqueness, integrity, and conflict handling, making the database—not the pipeline—the final arbiter of correctness.


## Running the Pipeline

Example (run locally with a configured PostgreSQL database):

```bash
python src/etl/run_fars_pipeline.py --years 1995 1996 1997
```

## Notes

- This project is under active development.

- Schemas, interfaces, and assumptions may evolve as additional validation and analysis layers are added.

- Raw FARS data is not included in this repository.
