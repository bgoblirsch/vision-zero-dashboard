# Vision Zero Dashboard – Design Notes

## Data Sources & Freshness

### FARS (Primary, National)
- Authoritative national dataset
- Released with ~2 year lag
- Latest year as of Project Start: 2023
- Used as baseline and for historical consistency

### State-Level Data (Supplemental, Fresher)
- Goal: fill gap between FARS release years
- Challenges:
  - Inconsistent schemas
  - Varying update frequency
  - Different geocoding quality
  - Unsure how reliably this data can assist in extrapolating FARS

### City-Level Data (Supplemental, Freshest)
- Initially targeting large cities with good open data portals
- Long-term goal: expand to most US cities >100k population
- Expect highest variability here

## Scope Decisions

- Current scope: US cities with population > 100k
- Rationale:
  - Keeps dataset manageable
  - Aligns with Vision Zero policy relevance
- Scope may expand later (criteria TBD)

## Architectural Notes

- ETL structured by dataset under `etl/extract/{dataset}`
