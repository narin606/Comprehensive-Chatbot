from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Sequence, Tuple

from openai import OpenAI
from pydantic import ValidationError

from .config import Settings, get_settings
from .knowledge import KnowledgeBase, KnowledgeChunk


class ChatbotService:
    """
    Provides a thin wrapper around OpenAI chat completions with contextual grounding
    against the local knowledge base.
    """

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or self._load_settings()
        self.client = OpenAI(api_key=self.settings.openai_api_key)

        self.external_csv_files = self._resolve_paths(self.settings.external_csv_paths)
        prompt_paths = [Path(self.settings.system_prompt_path)] + self._resolve_paths(
            self.settings.external_prompt_paths
        )
        self.prompt_library = self._load_prompt_library(prompt_paths)
        self.system_prompt = self._compose_system_prompt()
        self.transcription_prompt = self._compose_transcription_prompt()

        self.knowledge = KnowledgeBase(
            self.settings.data_dir,
            external_csv_paths=self.external_csv_files,
        )

    @staticmethod
    def _load_settings() -> Settings:
        try:
            return get_settings()
        except ValidationError as exc:
            missing = ", ".join(err["loc"][0] for err in exc.errors())
            raise RuntimeError(
                "Missing required environment configuration. "
                f"Populate the following variables in a .env file: {missing}"
            ) from exc

    @staticmethod
    def _resolve_paths(raw_paths: Sequence[str | Path]) -> List[Path]:
        resolved: List[Path] = []
        seen = set()
        for raw_path in raw_paths:
            if raw_path is None or raw_path == "":
                continue
            path = Path(raw_path).expanduser()
            if path in seen:
                continue
            seen.add(path)
            resolved.append(path)
        return resolved

    @staticmethod
    def _load_prompt_library(prompt_paths: Sequence[Path]) -> Dict[str, List[str]]:
        library: Dict[str, List[str]] = {}
        for path in prompt_paths:
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8").strip()
            if not text:
                continue
            library.setdefault(path.stem.lower(), []).append(text)
        return library

    def _compose_system_prompt(self) -> str:
        system_prompts = self.prompt_library.get("system_prompt")
        if not system_prompts:
            raise FileNotFoundError(
                "No system prompt files were found. "
                f"Checked: {self.settings.system_prompt_path} plus any configured external prompts."
            )
        return "\n\n".join(system_prompts)

    def _compose_transcription_prompt(self) -> str | None:
        candidates: List[str] = []
        for key in ("transcribe_prompt", "transcription_prompt"):
            candidates.extend(self.prompt_library.get(key, []))
        if not candidates:
            return None
        return "\n".join(candidates)

    def build_context(self, question: str, top_k: int = 8) -> Tuple[str, List[Dict[str, object]]]:
        """
        Assemble the reference context for the given question.
        Returns a tuple of formatted context text and structured source metadata.
        """

        relevant_chunks: List[KnowledgeChunk] = self.knowledge.most_relevant(question, top_k=top_k)
        formatted_sections: List[str] = []
        sources: List[Dict[str, object]] = []

        for chunk in relevant_chunks:
            friendly_source = chunk.source.stem.replace("_", " ").title()
            section_number = chunk.section_index + 1
            label = f"{friendly_source} (Section {section_number})"
            formatted_sections.append(f"Source: {label}\n{chunk.text}")
            sources.append({"title": friendly_source, "section": section_number})

        context_block = "\n\n".join(formatted_sections)
        return context_block, sources

    def answer_question(
        self, question: str, history: List[Dict[str, str]] | None = None
    ) -> Dict[str, object]:
        """
        Call OpenAI with a structured set of messages and return the response
        alongside the context references used.
        """

        history = history or []
        context_block, sources = self.build_context(question)

        messages = [{"role": "system", "content": self.system_prompt}]
        for item in history:
            if "role" in item and "content" in item:
                messages.append({"role": item["role"], "content": item["content"]})

        messages.append(
            {
                "role": "system",
                "content": (
                    "Use the following context to answer the user's question. "
                    "If the context is not relevant, say you do not have the answer.\n\n"
                    f"{context_block}"
                ),
            }
        )
        messages.append({"role": "user", "content": question})

        completion = self.client.chat.completions.create(
            model=self.settings.openai_model,
            temperature=self.settings.openai_temperature,
            messages=messages,
        )

        answer = completion.choices[0].message.content.strip()
        return {"answer": answer, "sources": sources}
