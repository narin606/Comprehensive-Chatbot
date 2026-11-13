from __future__ import annotations

import sys
from pathlib import Path


def main() -> None:
    from app.config import get_settings
    from app.knowledge import KnowledgeBase

    settings = get_settings()
    kb = KnowledgeBase(settings.data_dir, settings.external_csv_paths)

    print("Loaded knowledge snippets:")
    for line in kb.sources_summary():
        print(f" - {line}")


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(project_root))
    main()
