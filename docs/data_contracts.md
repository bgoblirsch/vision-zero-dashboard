# Data Contracts

This document defines the guarantees, assumptions, and invariants enforced by the Vision Zero Dashboard data pipeline.

The purpose of these contracts is to ensure downstream analyses, dashboards, and metrics can rely on a consistent and well-understood data model, despite historical inconsistencies in upstream data sources.

---

## Scope

These contracts apply to the **`accidents`** table populated from the U.S. Fatality Analysis Reporting System (FARS), covering data from **1987 to present**.

They describe:
- Structural guarantees (schema, keys)
- Value-level guarantees (ranges, consistency)
- Known limitations and intentional gaps

---

## Core Entity: `accidents`

Each row represents a single fatal crash case as defined by FARS.

---

## Primary Identifiers

- **`st_case`** (INTEGER, NOT NULL)  
  State-specific crash identifier provided by FARS.

- **`year`** (INTEGER, NOT NULL)  
  Calendar year of the crash.  
  Always derived from the dataset year and never inferred solely from the accident date.

### Uniqueness Guarantee

The following invariant is enforced at the database level:
- (st_case, year) uniquely identifies a crash

---

## Temporal Fields

- **`accident_date`** (DATE, nullable)

### Guarantees

- If present, `accident_date` falls between `1987-01-01` and `2023-12-31`
- Some early FARS years contain partial or invalid date components
- In such cases:
  - `year` is always populated
  - `accident_date` may be NULL

Downstream consumers should prefer `year` for temporal aggregation and treat `accident_date` as optional.

---

## Geographic Fields

- **`state`**, **`county`**, **`city`** (INTEGER, NOT NULL)  
  Encoded using FARS / GSA geographic codes

- **`state_name`**, **`county_name`**, **`city_name`** (VARCHAR, nullable)

### Guarantees

- Geographic **codes** are always present
- Geographic **names** may be NULL for certain historical years
- Name fields are descriptive metadata and should not be used as identifiers

---

## Spatial Data

- **`location`** (GEOMETRY(Point, 4326), nullable)

### Guarantees

- If present:
  - Geometry is a valid `POINT`
  - SRID is always `4326` (WGS84)
- If absent:
  - Crash occurred prior to reliable coordinate reporting
  - Or coordinates were missing or invalid in the source data

No spatial interpolation or inference is performed during ingestion.

---

## Fatality Counts

- **`total_fatalities`** (INTEGER, NOT NULL)
- **`motorist_fatalities`** (INTEGER, NOT NULL)
- **`cyclist_fatalities`** (INTEGER, NOT NULL)
- **`pedestrian_fatalities`** (INTEGER, NOT NULL)

### Guarantees

- All fatality counts are greater than or equal to zero
- Internal consistency is enforced:
    - total_fatalities
    - motorist_fatalities
    - cyclist_fatalities
    - pedestrian_fatalities   
- Implausible values are rejected during ingestion:
  - `total_fatalities > 50` is considered invalid


- Implausible values are rejected during ingestion:
  - `total_fatalities > 50` is considered invalid

---

## Data Integrity Enforcement

The following checks are **blocking** and will fail the pipeline if violated:

- Duplicate `(st_case, year)` records
- Missing required identifiers (`st_case`, `year`, `state`)
- Accident dates outside the supported range
- Fatality totals that do not equal the sum of subtype counts
- Implausible fatality counts

Additional informational checks (row counts, completeness metrics) are logged but do not block ingestion.

---

## Known Limitations

- Person-level records are not yet joined
- City and county names may be missing in older years
- Pre-1999 crashes may lack spatial coordinates
- No attempt is made to backfill or infer missing values during ingestion

These limitations are intentional to preserve data lineage and auditability.

---

## Contract Evolution

This document will evolve as:
- Person-level joins are introduced
- Additional data sources are integrated
- New validation rules are added

Any breaking changes will be accompanied by updated validation logic and clear documentation of impact.
