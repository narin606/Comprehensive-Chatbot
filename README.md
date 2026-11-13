# Comprehensive Chatbot

A customizable company chatbot and kiosk interface, currently configured for Oneberry Technologies and its KenOBI assistant. It combines a Python FastAPI backend with a Next.js frontend.

> **Credentials required:** This repository does not include an OpenAI API key. Before starting the backend, copy `.env.example` to `.env` and enter your own valid `OPENAI_API_KEY`. Chat, voice transcription, and translation require an account with access to the configured models and available API quota. A placeholder key will not work.

## Start here

- [Credentials and setup](docs/SETUP.md): enter credentials, install dependencies, run the app, and troubleshoot.
- [Functionality and customization](docs/CUSTOMIZATION.md): understand the project and find exactly which files to edit.

## Features

- Company question answering using local text and optional FAQ CSV documents, with source references.
- Conversation history passed from the browser to the backend for follow-up questions.
- Voice recording, OpenAI transcription, and optional translation into English.
- Video/media catalogue with locally served assets.
- Home slideshow, company branding, and a kiosk-style interface.
- Docker configuration and Windows/Linux helper scripts.

The knowledge search uses keyword overlap; it does not use embeddings or a vector database. Chat history lives in browser component state and is not stored in a database.

## Quick start (Windows PowerShell)

Run from the project root:

```powershell
Copy-Item .env.example .env
notepad .env
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Enter your real key only in the local `.env`. In a second terminal:

```powershell
cd frontend-next
npm ci
npm run dev
```

Open http://localhost:3000. Backend health: http://127.0.0.1:8000/health.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Backend routes, OpenAI integration, settings, knowledge retrieval, and media helpers |
| `app/prompts/system_prompt.txt` | Assistant identity, scope, tone, and answer rules |
| `data/knowledge/` | Company information in text files |
| `data/media/` | Media catalogue and videos |
| `data/slideshow/` | Home slideshow images |
| `frontend-next/` | Main Next.js interface |
| `frontend/` | Alternative plain HTML/CSS/JavaScript interface |
| `scripts/` | Development and knowledge inspection helpers |
| `tests/` | Existing backend tests |
| `docs/` | Setup and customization guides |

## Credentials and deployment

Never commit your local `.env`, API keys, or other credentials. The ignore files exclude environment files while allowing safe example templates. OpenAI credentials belong only on the backend; never put them in `NEXT_PUBLIC_*` variables or browser code.

The included backend has no application authentication and allows all CORS origins. Review access controls, allowed origins, dependency versions, and uploaded content before exposing it on a public network. The included company branding and media should be replaced as appropriate for your own deployment.
