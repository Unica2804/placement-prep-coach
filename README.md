# Placement Prep Coach

Resume+JD-aware mock interviewer. Heavy inference runs **on-device** (Gemma + Parakeet WASM); Render hosts the app + Mastra orchestration and sleeps when idle.

## Models (locked)

* LLM: `unsloth/gemma-4-E2B-it-GGUF` — `gemma-4-E2B-it-IQ4_XS.gguf` (2.98 GB, Apache-2.0)
* STT: `handy-computer/parakeet-tdt-0.6b-v3-gguf` — `parakeet-tdt-0.6b-v3-Q4_K_M.gguf` (485 MB, CC-BY-4.0)

Weights are lazy-loaded in-browser (B2/S3). Server never sees resume/audio unless opt-in backup is checked.

## Run

```bash
npm ci
npm test
npm start # :3000
```

## Deploy (Render, sleep when idle)

`render.yaml` defines a Node 22 web service with `/healthz`. Set `GEMMA_GGUF_URL` / `PARAKEET_GGUF_URL` if proxying weights.

## Docs

Read `AGENTS.md` first, then `ARCHITECTURE.md`, `BACKLOG.md`, `FAILED_APPROACH.md`.
