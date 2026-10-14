import test from "node:test";
import assert from "node:assert/strict";
import { downsampleTo16k, encodeWav16k, wavDurationSec } from "../src/ai/audio.js";

test("downsampleTo16k halves 32 kHz correctly", () => {
  const input = new Float32Array([0, 0.5, 1, 0.5]); // 32 kHz
  const out = downsampleTo16k(input, 32000);
  assert.equal(out.length, 2);
  assert.ok(Math.abs(out[0] - 0) < 1e-6);
  assert.ok(Math.abs(out[1] - 1) < 1e-6);
});

test("downsampleTo16k is identity at 16 kHz", () => {
  const input = new Float32Array([0.1, -0.2, 0.3]);
  const out = downsampleTo16k(input, 16000);
  assert.deepEqual([...out], [...input]);
});

test("downsampleTo16k rejects upsampling", () => {
  assert.throws(() => downsampleTo16k(new Float32Array([1]), 8000), /upsampling/);
});

test("downsampleTo16k handles 48 kHz mic rate", () => {
  const out = downsampleTo16k(new Float32Array(48000).fill(0.5), 48000);
  assert.equal(out.length, 16000);
  assert.ok(out.every((s) => Math.abs(s - 0.5) < 1e-6));
});

test("encodeWav16k header + round-trip duration", () => {
  const wav = encodeWav16k(new Float32Array(16000).fill(0));
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(36, 40)), "data");
  assert.equal(wavDurationSec(wav), 1);
});

test("encodeWav16k clamps out-of-range samples", () => {
  const wav = encodeWav16k(new Float32Array([2, -2]));
  const v = new DataView(wav.buffer);
  assert.equal(v.getInt16(44, true), 0x7fff);
  assert.equal(v.getInt16(46, true), -0x8000);
});
