// On-device session store: IndexedDB (primary) with JSON export/import.
// Server backup stays opt-in (PUT /api/sessions/:id with consent) — see server.js.
// Works in browsers; in Node tests it runs on fake-indexeddb.
const DB = "prep-coach";
const VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("turns")) {
        const turns = db.createObjectStore("turns", { keyPath: "tid" });
        turns.createIndex("bySession", "sid", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, stores, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    fn(t);
  });
}

export async function saveSession(session) {
  const db = await openDb();
  await tx(db, ["sessions"], "readwrite", (t) => t.objectStore("sessions").put(session));
  db.close();
}

export async function getSession(id) {
  const db = await openDb();
  const row = await new Promise((resolve, reject) => {
    const t = db.transaction(["sessions"], "readonly");
    const q = t.objectStore("sessions").get(id);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  db.close();
  return row || null;
}

export async function appendTurn(sid, turn) {
  const db = await openDb();
  const row = { ...turn, sid, tid: `${sid}:${Date.now().toString(36)}:${Math.floor(Math.random() * 1e6)}` };
  await tx(db, ["turns"], "readwrite", (t) => t.objectStore("turns").put(row));
  db.close();
  return row.tid;
}

export async function getTurns(sid) {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const t = db.transaction(["turns"], "readonly");
    const q = t.objectStore("turns").index("bySession").getAll(sid);
    q.onsuccess = () => resolve(q.result || []);
    q.onerror = () => reject(q.error);
  });
  db.close();
  return rows.sort((a, b) => (a.tid < b.tid ? -1 : 1));
}

export async function exportSession(id) {
  const session = await getSession(id);
  if (!session) return null;
  return { ...session, turns: await getTurns(id), exportedAt: new Date().toISOString() };
}

export async function importSession(bundle) {
  if (!bundle?.id) throw new Error("bundle missing id");
  await saveSession({ ...bundle, turns: undefined });
  for (const t of bundle.turns || []) {
    const db = await openDb();
    await tx(db, ["turns"], "readwrite", (x) => x.objectStore("turns").put({ ...t, sid: bundle.id }));
    db.close();
  }
  return bundle.id;
}
