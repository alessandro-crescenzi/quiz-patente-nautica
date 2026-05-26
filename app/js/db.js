// Wrapper IndexedDB per persistenza tentativi e sessioni
const DB_NAME = "quizPatenteNautica";
const DB_VERSION = 1;
const STORE_ATTEMPTS = "attempts";
const STORE_SESSIONS = "sessions";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        const s = db.createObjectStore(STORE_ATTEMPTS, { keyPath: "id", autoIncrement: true });
        s.createIndex("by_prog", "progressivo", { unique: false });
        s.createIndex("by_session", "sessionId", { unique: false });
        s.createIndex("by_corretta", "corretta", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const s = db.createObjectStore(STORE_SESSIONS, { keyPath: "id", autoIncrement: true });
        s.createIndex("by_finishedAt", "finishedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode = "readonly") {
  return openDb().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addAttempt(record) {
  const store = await tx(STORE_ATTEMPTS, "readwrite");
  return reqToPromise(store.add({ ...record, ts: Date.now() }));
}

export async function addSession(record) {
  const store = await tx(STORE_SESSIONS, "readwrite");
  return reqToPromise(store.add(record));
}

export async function updateSession(id, patch) {
  const store = await tx(STORE_SESSIONS, "readwrite");
  const existing = await reqToPromise(store.get(id));
  Object.assign(existing, patch);
  return reqToPromise(store.put(existing));
}

export async function getAllAttempts() {
  const store = await tx(STORE_ATTEMPTS);
  return reqToPromise(store.getAll());
}

export async function getAllSessions() {
  const store = await tx(STORE_SESSIONS);
  return reqToPromise(store.getAll());
}

export async function getWrongAttempts() {
  const all = await getAllAttempts();
  return all.filter((a) => !a.corretta);
}

export async function clearAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction([STORE_ATTEMPTS, STORE_SESSIONS], "readwrite");
    t.objectStore(STORE_ATTEMPTS).clear();
    t.objectStore(STORE_SESSIONS).clear();
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
