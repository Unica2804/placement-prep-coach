import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TRANSCRIBE_BIN, PARAKEET_MODEL } from "../src/ai/sttPaths.js";

process.env.NODE_ENV = "test";
const { default: app } = await import("../src/server.js");

const sttProvisioned = () =>
  fs.existsSync(TRANSCRIBE_BIN) && fs.existsSync(PARAKEET_MODEL);

let base = "";
let srv = null;
before(() => new Promise((resolve) => {
  srv = app.listen(0, () => {
    base = `http://127.0.0.1:${srv.address().port}`;
    resolve();
  });
}));
after(() => new Promise((resolve) => srv.close(() => resolve())));

async function call(method, url, body) {
  const r = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

test("GET /healthz is 200", async () => {
  const r = await call("GET", "/healthz");
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test("POST /api/session returns question + profile", async () => {
  const r = await call("POST", "/api/session", { resumeText: "Skills: JS\nIntern at Acme", jd: "SDE intern", role: "SDE" });
  assert.equal(r.status, 200);
  assert.ok(r.data.sessionId);
  assert.ok(r.data.question);
});

test("POST /api/turn rejects empty answer with 400", async () => {
  const r = await call("POST", "/api/turn", { question: "Q", answer: "  " });
  assert.equal(r.status, 400);
});

test("POST /api/transcribe requires consent", async () => {
  const wav = Buffer.from(new Uint8Array(44 + 16000 * 2));
  const denied = await fetch(base + "/api/transcribe", {
    method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav,
  });
  assert.equal(denied.status, 400);
});

test("POST /api/transcribe returns transcript when provisioned", { skip: !sttProvisioned() }, async () => {
  const tone = new Float32Array(16000);
  for (let i = 0; i < tone.length; i++) tone[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / 16000);
  const { encodeWav16k } = await import("../src/ai/audio.js");
  const r = await fetch(base + "/api/transcribe?consent=1", {
    method: "POST", headers: { "Content-Type": "audio/wav" }, body: Buffer.from(encodeWav16k(tone)),
  });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(typeof d.text, "string");
  assert.match(d.engine, /parakeet/);
});

test("PUT /api/sessions requires consent", async () => {
  const denied = await call("PUT", "/api/sessions/s_1", { turn: 1 });
  assert.equal(denied.status, 400);
  const ok = await call("PUT", "/api/sessions/s_1", { consent: true, turn: 1 });
  assert.equal(ok.status, 200);
});

// Graceful degradation: under test the 3 GB GGUF is gated off, so every path
// must still answer from the deterministic rules and say which engine ran.
test("session and turn report the engine and fall back to rules without weights", async () => {
  const health = await call("GET", "/healthz");
  assert.equal(health.data.stt, true);
  assert.equal(health.data.llm, false);

  const s = await call("POST", "/api/session", { resumeText: "Skills: JS\nIntern at Acme", jd: "SDE", role: "SDE" });
  assert.equal(s.data.engine, "rules");
  assert.ok(s.data.question);

  const t = await call("POST", "/api/turn", {
    question: s.data.question, answer: "I built a rate limiter because latency mattered, cutting p99 by 60%.",
    profile: s.data.profile, jd: "SDE", turn: 0,
  });
  assert.equal(t.data.engine, "rules");
  assert.equal(typeof t.data.eval.score, "number");
  assert.ok(t.data.nextQuestion);
});

