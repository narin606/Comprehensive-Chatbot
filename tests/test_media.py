from pathlib import Path

from fastapi.testclient import TestClient

from app.media import MediaLibrary
from app.main import app

client = TestClient(app)


def test_media_library_loads_catalog(tmp_path: Path):
    sample = tmp_path / "catalog.json"
    sample.write_text(
        '[{"id": "demo", "title": "Demo", "description": "desc", "media_type": "video", "source": "https://example.com/video.mp4"}]',
        encoding="utf-8",
    )

    library = MediaLibrary(sample)
    items = library.list_items()

    assert len(items) == 1
    assert items[0].id == "demo"
    assert items[0].media_type == "video"


def test_media_endpoint_returns_items():
    response = client.get("/media")
    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert isinstance(payload["items"], list)
    assert len(payload["items"]) >= 1
    first = payload["items"][0]
    assert {"id", "title", "description", "media_type", "source"}.issubset(first.keys())
