from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence


def _tokenize(text: str) -> List[str]:
    """Lightweight tokenizer that keeps alphanumeric words and lowercases them."""

    return re.findall(r"[a-z0-9]+", text.lower())


@dataclass(frozen=True)
class KnowledgeChunk:
    """Represents a single retrievable passage with source metadata."""

    text: str
    source: Path
    section_index: int
    tokens: Sequence[str]


class KnowledgeBase:
    """Loads local knowledge files plus optional CSV sources and ranks passages by keyword overlap."""

    def __init__(self, knowledge_dir: Path, external_csv_paths: Sequence[Path] | None = None):
        self.knowledge_dir = knowledge_dir
        self.external_csv_paths = [Path(path) for path in (external_csv_paths or [])]
        self.chunks: List[KnowledgeChunk] = []
        self._load_knowledge()

    def _load_knowledge(self) -> None:
        if not self.knowledge_dir.exists():
            raise FileNotFoundError(
                f"Knowledge directory {self.knowledge_dir} does not exist. "
                "Create it and add .txt files with Oneberry information."
            )

        chunks: List[KnowledgeChunk] = []
        chunks.extend(self._load_text_chunks())
        chunks.extend(self._load_csv_chunks())

        if not chunks:
            extra_hint = ""
            if self.external_csv_paths:
                extra_hint = (
                    f" and ensure the CSV files exist at: {', '.join(map(str, self.external_csv_paths))}"
                )
            raise ValueError(
                f"No usable knowledge found in {self.knowledge_dir}{extra_hint}. "
                "Ensure the files contain relevant Oneberry information."
            )

        self.chunks = chunks

    def _load_text_chunks(self) -> List[KnowledgeChunk]:
        chunks: List[KnowledgeChunk] = []
        for path in sorted(self.knowledge_dir.glob("*.txt")):
            content = path.read_text(encoding="utf-8").strip()
            if not content:
                continue

            sections = [section.strip() for section in content.split("\n\n") if section.strip()]
            for idx, section in enumerate(sections):
                tokens = _tokenize(section)
                if tokens:
                    chunks.append(KnowledgeChunk(section, path, idx, tokens))
        return chunks

    def _load_csv_chunks(self) -> List[KnowledgeChunk]:
        chunks: List[KnowledgeChunk] = []
        for csv_path in self.external_csv_paths:
            if not csv_path.exists():
                continue

            with csv_path.open(encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                for idx, row in enumerate(reader):
                    section = self._format_csv_row(row)
                    if not section:
                        continue
                    tokens = _tokenize(section)
                    if tokens:
                        chunks.append(KnowledgeChunk(section, csv_path, idx, tokens))
        return chunks

    @staticmethod
    def _format_csv_row(row: dict[str, str | None]) -> str:
        question = (row.get("Question") or row.get("question") or "").strip()
        answer = (row.get("Answer") or row.get("answer") or "").strip()
        link = (row.get("Link") or row.get("URL") or row.get("link") or "").strip()

        parts: List[str] = []
        if question:
            parts.append(f"Question: {question}")
        if answer:
            parts.append(f"Answer: {answer}")
        if link:
            parts.append(f"URL: {link}")
        return "\n".join(parts)

    def reload(self) -> None:
        """Reload knowledge from disk."""

        self._load_knowledge()

    def most_relevant(self, query: str, top_k: int = 3) -> List[KnowledgeChunk]:
        """Retrieve the top-k passages by keyword overlap with the query."""

        query_tokens = set(_tokenize(query))
        if not query_tokens:
            return self.chunks[:top_k]

        scored: List[tuple[float, KnowledgeChunk]] = []
        for chunk in self.chunks:
            overlap = query_tokens.intersection(chunk.tokens)
            score = len(overlap) / max(len(chunk.tokens), 1)
            scored.append((score, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [chunk for score, chunk in scored[:top_k] if score > 0] or self.chunks[:top_k]

    def sources_summary(self) -> Iterable[str]:
        """Provide a short summary of loaded files for debugging/logging."""

        for chunk in self.chunks:
            yield f"{chunk.source.name} (section {chunk.section_index + 1})"
