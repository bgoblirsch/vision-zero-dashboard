# Vision Zero Dashboard

**[https://visionzerodata.com](https://visionzerodata.com)**

A full-stack data engineering project that ingests, normalizes, and analyzes U.S. traffic fatality data in support of [Vision Zero](https://visionzeronetwork.org/)–style safety analysis for large cities. 

Includes a custom interactive dashboard built FARS data, featuring per-capita fatality rates, trend analysis, and cross city rankings for U.S. cities with a population greater than 100,000 and all Vision Zero cities. 

Designed to help advocates, researchers, and policymakers track city-level progress, identify where Vision Zero commitments aren't being met, and surface crash patterns for deeper safety analysis.

## About Vision Zero
Vision Zero is a road safety initiative, originating in Sweden, built on the principle that traffic deaths and serious injuries are preventable, not inevitable. Cities that adopt Vision Zero make a formal commitment to eliminating traffic fatalities through infrastructure improvements, policy changes, and data-driven analysis.

---

## Tech Stack

**Pipeline**
- Python 3.12
- psycopg (PostgreSQL driver)
- tqdm (progress tracking)
- boto3

**Database**
- PostgreSQL with PostGIS
- Spatial indexes (GiST) on geometry columns

**Frontend**
- React + Vite
- Deck.gl (map)
- Recharts (charts)

**Deployment**
- Cloudflare R2 (static data)
- Vercel (frontend)

---

## Data Sources

- [FARS - Fatality Analysis Reporting System](https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars)
  - Nationwide annual fatality data with a ~2 year lag.
- [TIGER Place Boundaries](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)
  - U.S. Census Bureau TIGER/Line shapefiles for city boundaries.
- [ACS Population data](https://www.census.gov/programs-surveys/acs.html)
  - U.S. Census Bureau American Community Survey (ACS) 5-year estimates for city population figures and per-capita calculations.
- [Nominatim Geocoding](https://nominatim.org/)
  - Nominatim geocoding from OpenStreetMap data for city point locations. 
- [Vision Zero City List](https://visionzeronetwork.org/resources/vision-zero-cities/)

---

## Current Status

**Complete**
- ETL pipeline for ~40 years of FARS data (1987–2024)
- City boundary and population data ingestion (TIGER/ACS)
- Spatial enrichment — crash point assignment to city boundaries
- Per-capita fatality rates and 5-year trend analysis
- Cross-city rankings with Vision Zero peer comparisons
- Interactive dashboard with map, city detail view, and fatality type filters
- Static Deployment: Cloudflare R2 serves static JSON data

**Planned**
- Mobile version
- FIPS backfill for pre-2001 non-spatial crash data
  - would allow the city chart history to span back to 1987
- Motorcycle fatality breakout filter

**Under Consideration**
- Crash hotspot and corridor analysis
- Incorporate annual population data for more accurate per capita calculations
  - Currently uses a 1-year snapshot for the per capita calculation
- Include Puerto Rico crash data
  - FARS includes Puerto Rico data via a separate dataset
  - Integration not yet explored
- State and local data integration for reduced reporting lag
- Nationwide crash and city coverage
  - Currently scoped to major cities due to static hosting constraints
  - Full coverage would require dedicated backend infrastructure

---

## Architecture

The pipeline uses an ETL pattern for ingestion, applying lightweight transforms inline during load, followed by post-load SQL transformations to derive city statistics and rankings, then exports pre-generated static JSON files uploaded to Cloudflare R2. The React frontend reads directly from R2 — there is no backend server.

### R2 Static file shape
crashes_metadata.json
cities.json
cities/{state_fips}/{place_fips}/annual_fatalities.json
cities/{state_fips}/{place_fips}/boundary.geojson
crashes/{state_fips}/{place_fips}/{year}.json

### Pipelines

There are two independent pipelines. The city pipeline is a prerequisite for the FARS pipeline and only needs to be re-run when updating city boundaries or population data (roughly every few years). The FARS pipeline runs annually as new data is published.

#### City Pipeline

Ingests U.S. city boundaries, population data, and point locations used for map rendering and per-capita calculations.

1. **Load city boundaries** — TIGER/Line shapefiles ingested into PostGIS as polygon geometries
2. **Load population data** — ACS 5-year estimates joined to city records
3. **Enrich city point locations** — representative point computed or resolved via OpenStreetMap/Nominatim for map rendering

### High-level flow

        ┌─────────────────────┐      ┌─────────────────────┐
        │     TIGER + ACS     │      │     FARS Data       │
        │  (Boundaries / Pop) │      │    (ZIP / CSV)      │
        └────────┬────────────┘      └──────────┬──────────┘
                 │                              │
                 ▼                              ▼
        ┌─────────────────────┐      ┌─────────────────────┐
        │   City Pipeline     │      │    Extract          │
        │ - Boundaries (shp)  │      │ - Download by year  │
        │ - Population (CSV)  │      │ - Skip if exists    │
        │ - City pt locations │      │ - Preserve raw files│
        └────────┬────────────┘      └──────────┬──────────┘
                 │                              │
                 ▼                              ▼
        ┌─────────────────────┐      ┌─────────────────────┐
        │  Spatial Enrichment │      │  Transform (inline) │
        │    OSM Nominatum    │      │ - Schema norm.      │
        │ One time API -> CSV │      │ - Date parsing      │
        │ For City pt. coords │      │ - Coord. handling   │
        └────────┬────────────┘      │ - Encoding cleanup  │
                 │                   └──────────┬──────────┘
                 │                              │
                 │                              ▼
                 │                   ┌─────────────────────┐
                 │                   │       Load          │
                 │                   │ - Batch inserts     │
                 │                   │ - ON CONFLICT       │
                 │                   │ - PostGIS geometry  │
                 │                   └──────────┬──────────┘
                 │                              │
                 │                              ▼
                 │                   ┌─────────────────────┐
                 │                   │ Spatial Enrichment  │
                 │                   │ - Assign crashes to │
                 │                   │   city boundaries   │
                 │                   └──────────┬──────────┘
                 │                              │
                 └──────────────┬───────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  PostgreSQL/PostGIS │
                     │  - fars_crashes     │
                     │  - census_places    │
                     │  - city_stats       │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  Derive City Stat   │
                     │  - 5yr averages     │
                     │  - Per-capita rates │
                     │  - Trend (% change) │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  Derive Rankings    │
                     │  - Rank among all   │
                     │  - Rank among VZ    │
                     │  - Percentiles      │
                     └──────────┬──────────┘
                                |
                                ▼
                     ┌─────────────────────┐
                     │  Export + Upload    │
                     │  - Generate JSON    │
                     │  - Upload to R2     │
                     └─────────────────────┘

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
  Both pipelins can be safely re-run year without duplicating data.

- **Historically aware**  
  Parsing and normalization logic explicitly accounts for known structural changes in FARS over time.

- **Disk-backed extraction**  
  Raw source files are retained locally, enabling inspection, reprocessing, and future transformations without re-downloading upstream data.

## Running the Pipeline

Example (run locally with a configured PostgreSQL database):

Run city pipeline (load city boundaries and population data).
**Must be run before the FARS pipeline.** Only needs to run every few years when updating population data.
```bash
python -m pipeline.etl.city_pipeline
```

Run the full FARS pipeline:
```bash
python scripts/cli_fars.py 
```

Run specific years:
```bash
python scripts/cli_fars.py --years 1995 1996 1997
```

Run enrichment only 
(assign city data to points that are missing city data but fall within a census place boundary):
```bash
python scripts/cli_fars.py --enrich-only
```

Validate only:
```bash
python scripts/cli_fars.py --validate-only
```

Export pipeline results to JSON:
(declare output directory in the project .env file)
```bash 
python -m pipeline.export.run_export
```

Upload to R2:
```bash
python -m pipeline.export.run_export
```

Reset the city pipeline and FARS pipeline tables:
```bash
ENV=local bash scripts/reset_all_tables.sh
```

Reset the FARS portion of the database for a fresh pipeline run:
```bash
ENV=local bash scripts/reset_fars_tables.sh 
```

Reset the city tables for a fresh pipeline run:
```bash
ENV=local bash scripts/reset_city_tables.sh 
```

## Notes

- This project is under active development.

- Schemas, interfaces, and assumptions may evolve as additional validation and analysis layers are added.

- Raw FARS data is not included in this repository.

- FastAPI backend archived in v0.1.0 release; can be revived if the project expands to justify full backend hosting.
