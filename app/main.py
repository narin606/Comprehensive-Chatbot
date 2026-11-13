from __future__ import annotations

import json
import logging
from io import BytesIO
from typing import Optional, List

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .chatbot import ChatbotService
from .media import MediaLibrary, MediaItem as MediaRecord

app = FastAPI(title="Oneberry Chatbot Backend", version="0.1.0")
chatbot = ChatbotService()
media_library = MediaLibrary(chatbot.settings.media_catalog_path)

media_assets_dir = chatbot.settings.media_catalog_path.parent
app.mount(
    "/media-assets",
    StaticFiles(directory=str(media_assets_dir)),
    name="media-assets",
)
slideshow_dir = chatbot.settings.slideshow_dir
if slideshow_dir.exists():
    app.mount(
        "/slideshow-assets",
        StaticFiles(directory=str(slideshow_dir)),
        name="slideshow-assets",
    )
else:
    logging.warning("Slideshow directory %s not found; skipping mount.", slideshow_dir)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] | None = None


class SourceItem(BaseModel):
    title: str
    section: int


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem]

class MediaItemModel(BaseModel):
    id: str
    title: str
    description: str
    media_type: str
    source: str
    thumbnail: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

class MediaResponse(BaseModel):
    items: List[MediaItemModel]


class TranscriptionResponse(BaseModel):
    text: str
    translated: bool
    detected_language: Optional[str] = None
    original_text: Optional[str] = None


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    history_payload = None
    if request.history:
        history_payload = [msg.model_dump() for msg in request.history]

    result = chatbot.answer_question(request.message, history=history_payload)
    return ChatResponse(answer=result["answer"], sources=result["sources"])


@app.get("/media", response_model=MediaResponse)
async def list_media(request: Request) -> MediaResponse:
    def resolve_source(raw: str) -> str:
        normalized = raw.strip()
        if not normalized:
            return normalized
        if normalized.startswith(("http://", "https://")):
            return normalized
        normalized = normalized.lstrip("/").replace("\\", "/")
        return str(request.url_for("media-assets", path=normalized))

    try:
        media_library.reload()
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Failed to load media catalogue: {exc}") from exc

    items = [
        MediaItemModel(
            id=item.id,
            title=item.title,
            description=item.description,
            media_type=item.media_type,
            source=resolve_source(item.source),
            thumbnail=item.thumbnail,
            tags=item.tags or [],
        )
        for item in media_library.list_items()
    ]
    return MediaResponse(items=items)


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    translate: bool = Form(False),
    language: Optional[str] = Form(None),
) -> TranscriptionResponse:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    audio_buffer = BytesIO(data)
    audio_buffer.name = file.filename or "audio.webm"

    kwargs = {
        "model": "gpt-4o-mini-transcribe",
        "file": audio_buffer,
        "response_format": "json",
    }
    if getattr(chatbot, "transcription_prompt", None):
        kwargs["prompt"] = chatbot.transcription_prompt
    if language and language.lower() not in {"auto", "none", "null"}:
        kwargs["language"] = language

    try:
        transcription = chatbot.client.audio.transcriptions.create(**kwargs)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc

    detected_language = None
    if isinstance(transcription, str):
        try:
            transcription_payload = json.loads(transcription)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to parse transcription payload: {exc}") from exc
        text = transcription_payload.get("text", "") or ""
        detected_language = transcription_payload.get("language")
    else:
        text = getattr(transcription, "text", "") or ""
        detected_language = getattr(transcription, "language", None)

    if not text:
        raise HTTPException(status_code=502, detail="The transcription service returned no text.")

    original_text = text
    translated_text = text
    was_translated = False

    if translate:
        try:
            completion = chatbot.client.chat.completions.create(
                model=chatbot.settings.openai_model,
                temperature=0,
                messages=[
                    {"role": "system", "content": "Translate the user's message into English. Return only the translation."},
                    {"role": "user", "content": text},
                ],
            )
            translated_text = completion.choices[0].message.content.strip()
            was_translated = True
        except Exception as exc:  # pylint: disable=broad-except
            raise HTTPException(status_code=500, detail=f"Translation failed: {exc}") from exc

    return TranscriptionResponse(
        text=translated_text,
        translated=was_translated,
        detected_language=detected_language,
        original_text=original_text if was_translated else None,
    )

