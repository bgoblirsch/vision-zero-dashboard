from logger import get_logger

logger = get_logger(__name__)

FIRST_FARS_YEAR = 1975
DEFAULT_START_YEAR = 1987
DEFAULT_END_YEAR = 2023 # !!! Temp hardcode !!!

def resolve_target_fars_years(
        requested_years: list[int] | None,
        *,
        start_year: int = DEFAULT_START_YEAR,
        end_year: int = DEFAULT_END_YEAR,
) -> list[int]:
    """
    Resolve which FARS years should be processed by the extract pipeline.

    Rules:
    - If requested_years is provided, those years are used verbatim (after validation).
    - If requested_years is None, a contiguous range from start_year to end_year
      (inclusive) is returned.
    - start_year defaults to 1987 due to known FARS schema changes prior to that year.

    This function is pure and performs no I/O.
    """
    if start_year < DEFAULT_START_YEAR:
        raise ValueError(
            f"start_year must be >= {DEFAULT_START_YEAR} due to FARS schema changes: got {start_year}"
        )
    if end_year > DEFAULT_END_YEAR:
        raise ValueError(
            f"end_year was greater than the latest available FARS release in {DEFAULT_END_YEAR}: got {end_year}"
        )
    
    if end_year < start_year:
        raise ValueError(
            f"end_year ({end_year}) must be >= start_year ({start_year})"
        )
    
    if requested_years is not None:
        return validate_requested_years(requested_years, start_year, end_year)

    return list(range(start_year, end_year + 1))


def validate_requested_years(
        years: list[int], 
        start_year: int, 
        end_year: int
) -> list[int]:
    years = sorted(set(years))
    invalid_years = [
        y for y in years
        if y < start_year or y > end_year
    ]

    if invalid_years:
        raise ValueError(
            f"Requested years out of range {start_year}–{end_year}: {invalid_years}"
        )

    return years