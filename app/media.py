from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass(frozen=True)
class MediaItem:
    id: str
    title: str
    description: str
    media_type: str
    source: str
    thumbnail: str | None = None
    tags: List[str] | None = None


class MediaLibrary:
    def __init__(self, catalog_path: Path):
        self.catalog_path = catalog_path
        self.items: List[MediaItem] = []
        self._load()

    def _load(self) -> None:
        if not self.catalog_path.exists():
            raise FileNotFoundError(
                f"Media catalog not found at {self.catalog_path}. Populate the file before running the service."
            )

        raw = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        items: List[MediaItem] = []
        for entry in raw:
            items.append(
                MediaItem(
                    id=entry["id"],
                    title=entry["title"],
                    description=entry.get("description", ""),
                    media_type=entry.get("media_type", "video"),
                    source=entry["source"],
                    thumbnail=entry.get("thumbnail"),
                    tags=entry.get("tags", []),
                )
            )
        if not items:
            raise ValueError("Media catalog is empty. Add at least one media entry.")
        self.items = items

    def reload(self) -> None:
        self._load()

    def list_items(self) -> List[MediaItem]:
        return list(self.items)
