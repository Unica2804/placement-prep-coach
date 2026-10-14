# AGENTS.md — Placement Prep Coach (main entrypoint)

> Read this file first. It indexes all agent rules and docs. No work starts without it.

## 1. What this is

Hacktoberfest Open-Source AI Challenge: **Week 2 — Side Hustle** (DEV challenge ID 80).
Window: Oct 12 19:00 UTC → Oct 19 06:59 UTC (Oct 18, 11:59 PM PDT).
Theme: build something with open-weight models / open-source AI that someone would actually pay for.

Our build: **Placement Prep Coach** — resume+JD-aware mock interviewer for placement seekers.
Buyer: final-year students / campus clubs. Monetization story: per-mock fee or club license.
Tracks targeted: **Best Use of Gemma + Best Use of Mastra + Best Use of Render** (+ Overall automatic).
One entry per participant. Submission = DEV post tagged `devchallenge, hf26challenge` using the Side Hustle template.

## 2. Doc index (read in this order)

1. `AGENTS.md` (this file) — rules, context, model locks, workflow.
2. `ARCHITECTURE.md` — detailed architecture. **Follow closely. Any change must be approved by the owner before implementation.**
3. `BACKLOG.md` — the only todo list. Work top-down. Update status as you go.
4. `FAILED_APPROACH.md` — banned approaches. **Never attempt anything listed here.** Check before any model/infra choice.

## 3. Locked models (do not swap without owner approval)

* LLM: `unsloth/gemma-4-E2B-it-GGUF`, file `gemma-4-E2B-it-IQ4_XS.gguf`, 2.98 GB, Apache-2.0, 128K context, multimodal, native function-calling.
* STT: `handy-computer/parakeet-tdt-0.6b-v3-gguf`, file `parakeet-tdt-0.6b-v3-Q4_K_M.gguf`, 485 MB, 0.6B FastConformer-TDT, CC-BY-4.0, 16 kHz mono WAV in, non-streaming.

## 4. Operating rules (non-negotiable)

1. **Architecture gate:** implement exactly what `ARCHITECTURE.md` says. Propose diffs to the owner, wait for approval.
2. **Backlog owns work:** anything needing doing lives in `BACKLOG.md`. No side quests.
3. **Banned list:** consult `FAILED_APPROACH.md` before choosing models, runtimes, or hosting. Week 1 lesson stands: never claim a track not meaningfully used.
4. **Test-first:** resume-parse spike and STT spike run before UI/infra. Detailed edge-case tests required (see BACKLOG.md §4).
5. **Research allowed:** DevRelay gateway + web search/webfetch permitted when stuck. Cite sources in reports.
6. **Privacy default:** resume text + voice stay on-device. Server backup is strictly opt-in with consent.
7. **Hosting:** Render Web Service (Node 22), **sleep when idle** to cap credits. Cold start is accepted; app shell must paint before weights finish.
8. **Git:** init/use git only inside this `Hack_Week-2` directory. Never touch any other repository.
9. **No submission without permission:** `create_article`, publishing, or any contest submit happens only after explicit owner yes. Drafts default `published:false`.

## 5. Workflow

1. Pick top item from `BACKLOG.md`, mark in-progress.
2. Run its tests/spikes, record results (tokens/sec, WER, recall).
3. On failure, check `FAILED_APPROACH.md`, propose ARCHITECTURE.md diff to owner — do not freelance.
4. Mark complete, move to next. Stop before any submit step and ask.
