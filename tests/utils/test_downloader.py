from utils.downloader import download_file


def test_download_file_writes_file(tmp_path, mocker):
    # --- Arrange ---
    fake_content = [b"hello ", b"world"]

    mock_response = mocker.MagicMock()
    mock_response.iter_content.return_value = fake_content
    mock_response.headers = {"content-length": "11"}
    mock_response.raise_for_status.return_value = None
    mock_response.__enter__.return_value = mock_response
    mock_response.__exit__.return_value = None

    mocker.patch(
        "utils.downloader.requests.get",
        return_value=mock_response,
    )

    dest = tmp_path / "test.bin"

    # --- Act ---
    result = download_file("http://example.com/file", dest)

    # --- Assert ---
    assert result == dest
    assert dest.exists()
    assert dest.read_bytes() == b"hello world"