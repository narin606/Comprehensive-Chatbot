# Knowledge Base

Place plain-text (`.txt`) files in this folder to expand the chatbot's knowledge.

Guidelines:
- Keep each document focused on a single subject (e.g. product line, press release, SOP).
- Separate major sections with a blank line; each section becomes an individual passage.
- Avoid embedding sensitive information (API keys, credentials, personal data).
- Re-run the backend (or call `KnowledgeBase.reload()`) after editing files so the new
  passages are picked up.

Example use cases:
- Summaries of Oneberry solutions and deployments.
- Extracts from internal manuals that should be answerable by the chatbot.
- Up-to-date pricing or FAQ documents (ensure they are approved for chatbot use).
