from etl.extract.fars.extract_fars import build_fars_url


def test_build_fars_url_contains_year():
    url = build_fars_url(2022)
    assert "2022" in url


def test_build_fars_url_has_expected_filename():
    url = build_fars_url(2023)
    assert url.endswith("FARS2023NationalCSV.zip")


def test_build_fars_url_is_https():
    url = build_fars_url(2021)
    assert url.startswith("https://")
