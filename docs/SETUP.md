# Credentials and setup

## Required before the chatbot works

Each person running this app must supply their own OpenAI API credentials. No real credentials are included in this repository.

1. Copy the root `.env.example` file to `.env`.
2. Open `.env` locally and enter a valid key after `OPENAI_API_KEY=`.
3. Ensure the associated OpenAI project has API quota/billing and access to the models used by this app.
4. Save the file and restart the backend after any changes.

Keep the key private. Do not paste it into chat messages, screenshots, GitHub issues, frontend files, or documentation. `.env` is excluded from Git and Docker build contexts. On a server, inject secrets through its environment or secret-management facilities.

| Setting | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required backend credential |
| `OPENAI_MODEL` | Chat and translation model; source default is `gpt-4o-mini` |
| `OPENAI_TEMPERATURE` | Chat response variation; default `0.3` |

The transcription model is currently `gpt-4o-mini-transcribe`, set in `app/main.py`. Model availability depends on your OpenAI account. Startup requires the key configuration; a running health endpoint does not prove the key is valid. Actual chat or voice requests validate access with OpenAI.

## Local installation

Install Python 3.10+ and Node.js/npm compatible with the pinned Next.js dependencies. These are the project's existing dependency pins, not a claim that they are current releases.

### Windows PowerShell

From the repository root:

```powershell
Copy-Item .env.example .env
notepad .env
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Keep that terminal running. In another terminal:

```powershell
cd frontend-next
npm ci
npm run dev
```

### Ubuntu/Linux

From the repository root:

```bash
cp .env.example .env
# Edit .env with your editor and enter your own key.
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, run `cd frontend-next`, `npm ci`, then `npm run dev`.

Open http://localhost:3000. The backend listens at http://127.0.0.1:8000; API documentation is at `/docs`, and health is at `/health`.

## Backend address for the browser

The Next.js interface reads `NEXT_PUBLIC_BACKEND_URL`, defaulting to `http://127.0.0.1:8000`. For another backend, create `frontend-next/.env.local`:

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://YOUR_BACKEND_HOST:8000
```

This URL is public configuration, not a secret. Never add the OpenAI key here. Restart development mode after changing it. Production Next.js builds embed public variables, so rebuild the frontend when changing this URL. A remote kiosk must use a hostname it can reach; its `127.0.0.1` refers to itself.

## Docker

After configuring the root `.env`:

```bash
docker compose up --build
```

Open http://localhost:3000 on the Docker host. The shipped frontend defaults to a browser-accessible backend at `127.0.0.1:8000`. The Compose runtime value `http://backend:8000` refers to Docker's internal network and is not a suitable browser URL; it also does not replace variables already embedded during the frontend build. For a remote kiosk deployment, supply a browser-accessible URL to the frontend build (for example through a Docker build argument wired into `Dockerfile.frontend` before `npm run build`) and rebuild.

Stop with `docker compose down`. The Docker recipes are included from the original project and have not been validated for every deployment environment.

## Checks and troubleshooting

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe scripts/refresh_knowledge.py
```

The existing tests use a dummy key and do not make OpenAI calls. They do not validate real credentials.

- Missing configuration at startup: ensure root `.env` exists and `OPENAI_API_KEY` is populated.
- Authentication/quota errors: check the key, project billing/quota, and model access.
- Cannot reach backend: confirm the server is running and the browser's backend URL is correct.
- Microphone unavailable: allow microphone access and use localhost or HTTPS.
- Incorrect company answers: update the knowledge files and system prompt, then restart the backend.
- Blank media/slideshow: check filenames and catalogue references; paths on Linux are case-sensitive.

The helper `scripts/dev.ps1` can launch the development services. Inspect `startup.sh` before using it: it installs dependencies and may stop existing processes on ports 8000 and 3000.
