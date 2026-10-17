import test from "node:test";
import assert from "node:assert/strict";
import {
  gemmaProvisioned,
  TurnResultSchema,
  GEMMA_MODEL,
  GEMMA_ENGINE,
} from "../src/ai/gemmaServer.js";

// The 3 GB GGUF is on disk in dev, so these tests pin the gates that keep it
// out of `npm test` rather than relying on the file being absent.
test("gemma is never provisioned under NODE_ENV=test", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  process.env.GEMMA_ENABLE = "1";
  assert.equal(gemmaProvisioned(), false);
  process.env.NODE_ENV = prev;
});

test("GEMMA_ENABLE=0 disables gemma outside tests", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevEnable = process.env.GEMMA_ENABLE;
  process.env.NODE_ENV = "production";
  process.env.GEMMA_ENABLE = "0";
  assert.equal(gemmaProvisioned(), false);
  process.env.NODE_ENV = prevEnv;
  process.env.GEMMA_ENABLE = prevEnable;
});

test("model path is the locked IQ4_XS GGUF and is env-overridable", () => {
  assert.match(GEMMA_MODEL, /gemma-4-E2B-it-IQ4_XS\.gguf$/);
  assert.equal(GEMMA_ENGINE, "gemma-4-E2B-it-IQ4_XS");
});

// Regression: a real turn was thrown away because the model returned the score
// as a string. Coercion must accept it instead of discarding the generation.
test("turn schema coerces the sloppy types small models actually emit", () => {
  const parsed = TurnResultSchema.safeParse({
    score: "7",
    strengths: "clear ownership",
    gaps: ["no metrics"],
    rewrite: "tighter version",
    nextQuestion: "What did you measure?",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.score, 7);
  assert.deepEqual(parsed.data.strengths, ["clear ownership"]);
  assert.deepEqual(parsed.data.gaps, ["no metrics"]);
});

test("turn schema still rejects output that cannot be salvaged", () => {
  assert.equal(TurnResultSchema.safeParse({ score: 11, nextQuestion: "ok?" }).success, false);
  assert.equal(TurnResultSchema.safeParse({ score: 4 }).success, false);
  assert.equal(TurnResultSchema.safeParse({ score: 4, nextQuestion: "hi" }).success, false);
  assert.equal(TurnResultSchema.safeParse({ score: "abc", nextQuestion: "ok?" }).success, false);
});

test("turn schema defaults the optional fields rather than failing the turn", () => {
  const parsed = TurnResultSchema.safeParse({ score: 6, nextQuestion: "Explain your testing." });
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.strengths, []);
  assert.deepEqual(parsed.data.gaps, []);
  assert.equal(parsed.data.rewrite, "");
});
