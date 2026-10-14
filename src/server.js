import express from "express";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runSetter, runEvaluator, runResumeParse } from "./mastra/agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public")));
app.use("/src", express.static(path.join(root, "src"))); // dev + Render: ships browser AI modules

const backupStore = new Map(); // opt-in only; primary store is IndexedDB on-device

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

app.post("/api/session", (req, res) => {
  const { resumeText = "", jd = "", role = "" } = req.body ?? {};
  const profile = runResumeParse(resumeText);
  profile.target_role = String(role || "").slice(0, 120);
  const session = {
    id: `s_${Date.now().toString(36)}`,
    profile,
    jd: String(jd || "").slice(0, 8000),
    turn: 0,
    history: [],
    createdAt: new Date().toISOString(),
  };
  const q = runSetter(profile, session.jd, 0);
  session.history.push({ role: "assistant", text: q });
  res.json({ sessionId: session.id, question: q, profile });
});

app.post("/api/turn", (req, res) => {
  const { question = "", answer = "", profile = {}, jd = "", turn = 0 } = req.body ?? {};
  if (!String(answer).trim()) return res.status(400).json({ error: "empty answer" });
  const eval_ = runEvaluator(String(question), String(answer));
  const nextQ = runSetter(profile, String(jd), Number(turn) + 1);
  res.json({ eval: eval_, nextQuestion: nextQ });
});

app.put("/api/sessions/:id", (req, res) => {
  if (req.body?.consent !== true) return res.status(400).json({ error: "backup requires explicit consent" });
  backupStore.set(req.params.id, { ...req.body, backedUpAt: new Date().toISOString() });
  res.json({ ok: true });
});

// Opt-in server transcription (Parakeet on Render, credits-funded).
// Default is on-device; this endpoint only runs when the user explicitly
// chooses server transcription in the UI (consent flag in JSON body wrapper).
// Body: raw 16 kHz mono WAV bytes (max ~5 min). Requires TRANSCRIBE_BIN +
// PARAKEET_MODEL env (render.yaml build provides both).
const TRANSCRIBE_BIN = process.env.TRANSCRIBE_BIN || "/tmp/transcribe.cpp/build/bin/transcribe-cli";
const PARAKEET_MODEL = process.env.PARAKEET_MODEL || "/tmp/parakeet-Q4_K_M.gguf";

app.post("/api/transcribe", express.raw({ type: "audio/wav", limit: "12mb" }), (req, res) => {
  if (req.query.consent !== "1") return res.status(400).json({ error: "server transcription requires explicit consent" });
  if (!req.body?.length) return res.status(400).json({ error: "empty audio" });
  if (!fs.existsSync(TRANSCRIBE_BIN) || !fs.existsSync(PARAKEET_MODEL)) {
    return res.status(503).json({ error: "server STT not provisioned on this host" });
  }
  const tmp = path.join(os.tmpdir(), `stt-${Date.now().toString(36)}.wav`);
  fs.writeFileSync(tmp, req.body);
  execFile(TRANSCRIBE_BIN, ["-m", PARAKEET_MODEL, tmp], { timeout: 120000 }, (err, stdout) => {
    fs.rmSync(tmp, { force: true });
    if (err) return res.status(500).json({ error: "transcription failed" });
    const m = String(stdout).match(/^text:\s*(.*)$/m);
    res.json({ text: (m?.[1] || "").trim(), engine: "parakeet-tdt-0.6b-v3-Q4_K_M" });
  });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`prep-coach listening on :${PORT}`));
}
export default app;
