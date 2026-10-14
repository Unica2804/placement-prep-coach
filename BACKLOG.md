# BACKLOG.md — Placement Prep Coach todo list

> The only todo list. Work top-down. Update status (`pending → in_progress → completed`) as you go. Nothing ships without owner permission.

## 1. Spikes (test-first, must run before UI/infra)

* [ ] **S1 — Gemma resume-parse matrix** (`in_progress`): 3 samples (clean txt / text PDF / scanned image) × `gemma-4-E2B-it-IQ4_XS.gguf` via wllama. Record field recall, tok/s, memory. Pass: clean >90%, PDF >70%.
* [ ] **S2 — OCR fallback probe** (`pending`): only if S1 scanned fails. PDF.js layer → Tesseract.js eng → re-run S1. Record lift.
* [x] **S3 — Parakeet transcription** (`completed` 2026-10-14): `parakeet-tdt-0.6b-v3-Q4_K_M.gguf` (463 MB) via transcribe.cpp `transcribe-cli` (CPU). 7.4 s clean → perfect transcript + punct/caps + word timestamps, 285 ms infer (26× RT), WER 0%. Same clip + white noise → identical transcript (noise-robust). 59.5 s concat → 2.6 s (23× RT), peak RSS 1.15 GB. Model load ~0.5 s from SSD. Implication: fits 2–4 GB budget; unload STT before loading Gemma LLM. WASM browser build still open (native proven here).
* [ ] **S4 — Mastra + Render overlap** (`pending`): `parseResume/nextQuestion/scoreAnswer` validation, trace journal, cold-start vs weight-download overlap, `/healthz` wake.

## 2. Build

* [x] **B1 — Scaffold** (`completed`): Vite+TS+Tailwind PWA shell, MIT LICENSE, README, `render.yaml` web service (sleep-when-idle), `.gitignore`, health endpoint.
* [ ] **B2 — On-device AI layer** (`pending`): wllama loader + progress/resume, Parakeet WASM loader, mic→WAV→VAD pipeline, OCR flag.
* [ ] **B3 — Mastra server** (`pending`): 3 agents + 3 tools + workflows + eval harness, anonymous `requestContext`, opt-in backup API.
* [ ] **B4 — Interview UI** (`pending`): professional Upload → 1Q + auto-grow voice textbox → Eval → Plan screens; IDB sessions; export/import.
* [ ] **B5 — Deploy proof** (`pending`): Render deploy, cold-start log, Lighthouse + PWA check, demo video/GIF.
* [ ] **B6 — First user** (`pending`): classmate mock, quote + willingness-to-pay note for submission bonus points.
* [ ] **B7 — DEV draft** (`pending`, needs explicit owner yes): `create_article(published:false)`, tags `devchallenge, hf26challenge`, Side Hustle template sections. **Do not publish.**

## 3. Edge-case test checklist (required with build)

* Resume: empty file, 50k-char truncation warning, PDF without text layer, skewed scan, PII redaction, non-English input.
* Models: WebGPU missing → CPU message; download interrupt/resume; 2 GB-RAM OOM guard; 128K context overflow guard.
* STT: silence, overlap, accented English, mic denied, 5-min answer memory.
* Store: quota exceeded, v1→v2 migration, export/import round-trip, backup off = zero PII egress (verify via network log).
* UI/API: XSS payload escaped, concurrent sessions isolated, bad sessionId 404, 360px layout, keyboard-only path, dark/light.
