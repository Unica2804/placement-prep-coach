# BACKLOG.md — Placement Prep Coach todo list

> The only todo list. Work top-down. Update status (`pending → in_progress → completed`) as you go. Nothing ships without owner permission.

## 1. Spikes (test-first, must run before UI/infra)

* [x] **S1 — Gemma resume-parse matrix** (`completed` 2026-10-14): `gemma-4-E2B-it-IQ4_XS.gguf` via node-llama-cpp (same GGUF/sampling as wllama path). Recipe: Gemma chat template + temp 0.5/topP 0.95/topK 64 + seed, parse-then-validate + 1 retry. Results: clean 11/17 (skills 7/7), PDF-noise 11/17, OCR-noise 10/17; ~1.5 s/extraction; load 3.3 s; peak RSS 4.28 GB (8K ctx — use 4K + unload STT first in prod). Key findings: (a) grammar-constrained decoding collapses to `{{}}`/empty placeholders at temp<=0.8 — BANNED, use parse-then-validate; (b) model summarizes exp bullets (loses latency metrics) — B2 prompt must demand verbatim bullets; (c) OCR confusions ("Pyth0n") need edit-distance-1 fuzzy match downstream; (d) wllama-in-Node blocked ("No supported storage backend" — needs browser IDB/OPFS), quality signal transfers, browser integration is B2 risk. Verdict: Gemma reads resumes — no mandatory OCR pipeline; Tesseract stays fallback for scans.
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
