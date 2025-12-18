import pytest
from etl.extract.fars.ingest_plan_fars import resolve_target_fars_years

def test_default_range():
    years = resolve_target_fars_years(None)
    assert years[0] == 1987
    assert years[-1] == 2023


def test_requested_years_are_used_verbatim():
    years = resolve_target_fars_years([2020, 2018, 2019])
    assert years == [2018, 2019, 2020]


def test_requested_years_below_start_year_raise():
    with pytest.raises(ValueError):
        resolve_target_fars_years([1980])


def test_end_year_before_start_year_raises():
    with pytest.raises(ValueError):
        resolve_target_fars_years(None, start_year=2020, end_year=2019)