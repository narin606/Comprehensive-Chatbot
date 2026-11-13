# Functionality and customization

## How the project works

1. The Next.js interface sends a question and current conversation history to `POST /chat`.
2. `app/knowledge.py` loads paragraphs from `data/knowledge/*.txt` and optional FAQ CSV rows. It ranks them using keyword overlap.
3. `app/chatbot.py` selects up to eight relevant passages, combines them with the system prompt and conversation history, then calls OpenAI.
4. The backend returns the generated answer and structured source titles/section numbers. The interface renders Markdown and source information.
5. Voice capture records browser audio and uploads it to `POST /transcribe`. The backend transcribes it and optionally uses the chat model to translate it into English.
6. `GET /media` reads the media catalogue and resolves local files through `/media-assets`. Slideshow images are served through `/slideshow-assets`.

`GET /health` reports that the backend is responding. It does not test OpenAI credentials.

Conversation state is held in the browser UI. There is no persistent chat database, user account system, document-upload ingestion UI, or vector database in the current code.

## What to edit

| What you want to customize | File or folder | What to change |
| --- | --- | --- |
| Assistant name, tone, scope, answer rules | `app/prompts/system_prompt.txt` | Replace KenOBI/Oneberry identity, company-only restrictions, and fallback wording |
| Company facts, products, services, partners | `data/knowledge/*.txt` | Replace existing company documents with your own; separate topics with blank lines |
| Optional FAQ data | `data/external/chatbot_csv_data/faq_data.csv` | Add a CSV with `Question,Answer,Link` headers |
| Optional supplementary prompts | `data/external/prompts/system_prompt.txt`, `transcribe_prompt.txt` | Add company rules and transcription vocabulary; system prompts are combined |
| Chat model and temperature | Root `.env` | Set `OPENAI_MODEL` and `OPENAI_TEMPERATURE`; keep the key local |
| Knowledge/prompt/media directory settings | `app/config.py` | Change defaults or configure corresponding settings through the environment |
| Retrieval/ranking | `app/knowledge.py` | Adjust tokenization, chunking, and keyword ranking |
| Number of context passages and model messages | `app/chatbot.py` | Adjust `build_context` top_k and message construction |
| API title, endpoints, CORS, transcription model | `app/main.py` | Change backend metadata, route behavior, allowed origins, and audio model |
| Main UI wording, navigation, welcome copy, slideshow entries | `frontend-next/app/page.tsx` | Replace company names and edit the `homeSlides` entries, image paths, and descriptions |
| Colors, spacing, layout, fonts | `frontend-next/app/globals.css` | Adjust interface styles |
| Browser title and metadata | `frontend-next/app/layout.tsx` | Replace company metadata |
| Main logo | `frontend-next/public/oneberry-logo.webp` and its UI references | Replace the asset or update paths when renaming it |
| Slideshow images | `data/slideshow/` | Replace images and keep paths in `homeSlides` synchronized |
| Videos and catalogue | `data/media/media_catalog.json`, `data/media/` | Update titles, descriptions, tags, and source filenames/URLs |
| Alternative static interface | `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`, `frontend/oneberry-logo.webp` | Update this separately if using the plain JavaScript version |
| Browser-to-backend address | `frontend-next/.env.local` | Set public `NEXT_PUBLIC_BACKEND_URL`; rebuild production bundles |
| Container/startup behavior | `Dockerfile.*`, `docker-compose.yml`, `scripts/dev.ps1`, `startup.sh` | Adjust ports, build configuration, and launch behavior |

## Example: change the assistant to your company

1. Rewrite the system prompt to identify the new assistant and company. Leaving the Oneberry-only instruction in place can prevent answers about your new company.
2. Replace all three shipped company knowledge text files with your own accurate information. Remove obsolete facts rather than only adding new ones.
3. Replace the logo, slideshow images, UI copy, and metadata. Search both frontend folders for `Oneberry` and `KenOBI`.
4. Update the media catalogue and put matching files in `data/media/`.
5. Configure your own local credentials, restart the backend, and restart or rebuild the frontend.
6. Test a known company question, an out-of-scope question, a follow-up, voice input, media playback, and the slideshow.

The main system prompt is always loaded. Optional external `system_prompt.txt` files supplement it; they do not automatically replace it. Avoid contradictory instructions.

## FAQ CSV example

Create `data/external/chatbot_csv_data/faq_data.csv` if needed:

```csv
Question,Answer,Link
"What services do you offer?","Describe your services here.","https://example.com/services"
```

Missing optional external files are skipped. Custom `EXTERNAL_CSV_PATHS` and `EXTERNAL_PROMPT_PATHS` settings use JSON arrays of path strings, for example:

```dotenv
EXTERNAL_CSV_PATHS=["data/external/chatbot_csv_data/faq_data.csv"]
```

Use forward slashes in these JSON path strings on Windows. Restart the backend after changing knowledge, prompts, or settings; there is no public knowledge-reload endpoint.

## Media catalogue example

```json
[
  {
    "id": "company-introduction",
    "title": "Company introduction",
    "description": "An overview of our services.",
    "media_type": "video",
    "source": "company-introduction.mp4",
    "thumbnail": null,
    "tags": ["Company", "Introduction"]
  }
]
```

Put the matching video in `data/media/`. A source can also be an HTTP(S) URL. The catalogue is reread on media requests; the interface may need a refresh to request the updated list.

## Extending beyond the starter

Persistent chat history requires storage and corresponding backend/UI changes. Authentication and restricted CORS require explicit backend or gateway configuration. Embedding-based retrieval requires replacing or extending the current keyword search. Keep private credentials exclusively on the backend when adding integrations.
