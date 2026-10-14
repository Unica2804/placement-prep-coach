import test from "node:test";
import assert from "node:assert/strict";
import { needsOcr, joinPages } from "../src/ai/resumePdf.js";

test("needsOcr: empty/short text → true", () => {
  assert.equal(needsOcr(""), true);
  assert.equal(needsOcr("   "), true);
  assert.equal(needsOcr("John Doe"), true); // scanned PDFs yield ~nothing from text layer
});

test("needsOcr: real resume text → false", () => {
  assert.equal(needsOcr("ARJUN MEHTA\nSkills: Python, React\n".repeat(10)), false);
});

test("needsOcr: boundary at 100 chars", () => {
  assert.equal(needsOcr("x".repeat(99)), true);
  assert.equal(needsOcr("x".repeat(100)), false);
});

test("joinPages joins with newlines and trims", () => {
  assert.equal(joinPages(["a", "", "b"]), "a\n\nb");
  assert.equal(joinPages([]), "");
});
