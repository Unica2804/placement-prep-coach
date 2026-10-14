import test from "node:test";
import assert from "node:assert/strict";
import { browserSpeechAvailable, dictateWithBrowserSpeech, transcribeWav16k } from "../src/ai/loaders.js";

test("browserSpeechAvailable is false without window (Node)", () => {
  assert.equal(browserSpeechAvailable(), false);
});

test("dictateWithBrowserSpeech throws without browser ASR", () => {
  assert.throws(() => dictateWithBrowserSpeech(), /browser-speech-unavailable/);
});

test("transcribeWav16k refuses without explicit consent (no upload)", async () => {
  const r = await transcribeWav16k(new Uint8Array([1, 2, 3]));
  assert.equal(r.ready, false);
  assert.equal(r.reason, "no-consent");
});
