import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";

globalThis.indexedDB = indexedDB;

const store = await import("../src/ai/store.js");

test("session round-trip: save → get", async () => {
  await store.saveSession({ id: "s_x", profile: { skills: ["js"] }, turn: 0 });
  const got = await store.getSession("s_x");
  assert.equal(got.profile.skills[0], "js");
});

test("getSession returns null for unknown id", async () => {
  assert.equal(await store.getSession("nope"), null);
});

test("turns append in order and scope to session", async () => {
  await store.appendTurn("s_x", { role: "assistant", text: "Q1" });
  await store.appendTurn("s_x", { role: "user", text: "A1" });
  await store.appendTurn("s_other", { role: "user", text: "leak?" });
  const turns = await store.getTurns("s_x");
  assert.equal(turns.length, 2);
  assert.equal(turns[0].text, "Q1");
  assert.ok(turns.every((t) => t.sid === "s_x"));
});

test("export/import round-trip preserves session + turns", async () => {
  const bundle = await store.exportSession("s_x");
  assert.ok(bundle.turns.length >= 2);
  assert.ok(bundle.exportedAt);
  await store.importSession({ ...bundle, id: "s_clone" });
  const clone = await store.getSession("s_clone");
  assert.equal(clone.profile.skills[0], "js");
  assert.equal((await store.getTurns("s_clone")).length, bundle.turns.length);
});

test("importSession rejects bundle without id", async () => {
  await assert.rejects(() => store.importSession({}), /missing id/);
});

test("exportSession returns null for unknown id", async () => {
  assert.equal(await store.exportSession("ghost"), null);
});
