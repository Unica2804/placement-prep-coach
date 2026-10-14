import test from "node:test";
import assert from "node:assert/strict";
import { browserSpeechAvailable, dictateWithBrowserSpeech } from "../src/ai/loaders.js";

test("browserSpeechAvailable is false without window (Node)", () => {
  assert.equal(browserSpeechAvailable(), false);
});

test("dictateWithBrowserSpeech throws without browser ASR", () => {
  assert.throws(() => dictateWithBrowserSpeech(), /browser-speech-unavailable/);
});
