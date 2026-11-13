from functools import lru_cache
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Using BaseSettings provides validation and sensible defaults while keeping the API key outside code.
    """

    openai_api_key: str = Field(..., env="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4o-mini", env="OPENAI_MODEL")
    openai_temperature: float = Field(0.3, env="OPENAI_TEMPERATURE")
    data_dir: Path = Field(default=Path(__file__).resolve().parents[1] / "data" / "knowledge")
    system_prompt_path: Path = Field(
        default=Path(__file__).resolve().parent / "prompts" / "system_prompt.txt"
    )
    media_catalog_path: Path = Field(
        default=Path(__file__).resolve().parents[1] / "data" / "media" / "media_catalog.json"
    )
    slideshow_dir: Path = Field(
        default=Path(__file__).resolve().parents[1] / "data" / "slideshow"
    )
    external_data_root: Path = Field(
        default=Path(__file__).resolve().parents[1] / "data" / "external"
    )

    external_csv_paths: List[str] = Field(default_factory=list)
    external_prompt_paths: List[str] = Field(default_factory=list)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """
    Load environment variables once and cache them for repeated access.
    """

    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    settings = Settings()

    if not settings.external_csv_paths:
        csv_path = settings.external_data_root / "chatbot_csv_data" / "faq_data.csv"
        settings.external_csv_paths = [str(csv_path)]

    if not settings.external_prompt_paths:
        base = settings.external_data_root / "prompts"
        settings.external_prompt_paths = [
            str(base / "system_prompt.txt"),
            str(base / "transcribe_prompt.txt"),
        ]

    return settings
