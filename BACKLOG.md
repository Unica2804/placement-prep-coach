# BACKLOG.md — Placement Prep Coach todo list

> The only todo list. Work top-down. Update status (`pending → in_progress → completed`) as you go. Nothing ships without owner permission.

## 1. Spikes (test-first, must run before UI/infra)

* [ ] **S1 — Gemma resume-parse matrix** (`pending`): 3 samples (clean txt / text PDF / scanned image) × `gemma-4-E2B-it-IQ4_XS.gguf` via wllama. Record field recall, tok/s, memory. Pass: clean >90%, PDF >70%.
* [ ] **S2 — OCR fallback probe** (`pending`): only if S1 scanned fails. PDF.js layer → Tesseract.js eng → re-run S1. Record lift.
* [ ] **S3 — Parakeet transcription** (`pending`): 30 s clean/noisy/accented 16 kHz samples × `parakeet-tdt-0.6b-v3-Q4_K_M.gguf` WASM. Record WER, cached load time, RTF. Pass: WER <10% clean, <2× realtime.
* [ ] **S4 — Mastra + Render overlap** (`pending`): `parseResume/nextQuestion/scoreAnswer` validation, trace journal, cold-start vs weight-download overlap, `/healthz` wake.

## 2. Build

* [ ] **B1 — Scaffold** (`pending`): Vite+TS+Tailwind PWA shell, MIT LICENSE, README, `render.yaml` web service (sleep-when-idle), `.gitignore`, health endpoint.
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
