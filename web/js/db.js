// SQLite in the browser (sql.js), persisted to IndexedDB. The whole DB is small, so we
// save the full file after each change. Backup/restore = download/upload that same file.

// This app shares an origin with other apps, so its storage names are its own. Never rename: existing data would be lost.
const IDB_NAME = "homeward";
const IDB_STORE = "files";
const IDB_KEY = "homeward.db";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS item (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,              -- word | sentence | mistake
  lemma TEXT,                      -- word items
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  context TEXT,                    -- source sentence, target marked [[like this]]
  context_en TEXT,
  note TEXT,
  category TEXT,                   -- mistake items
  text_id INTEGER REFERENCES text(id) ON DELETE SET NULL,
  submission_id INTEGER REFERENCES submission(id) ON DELETE CASCADE,
  suspended INTEGER NOT NULL DEFAULT 0,
  mine INTEGER NOT NULL DEFAULT 0, -- added by hand in "Add your own"
  ref TEXT,                        -- course item this came from: "<unit>:w:<n>" or "<unit>:p:<n>"
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_item_kind ON item(kind);
CREATE INDEX IF NOT EXISTS ix_item_lemma ON item(lemma);
CREATE INDEX IF NOT EXISTS ix_item_ref ON item(ref);

CREATE TABLE IF NOT EXISTS card (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
  template TEXT NOT NULL DEFAULT 'recog',   -- recog (Yoruba → English) | produce (English → Yoruba, typed) | fix
  due INTEGER NOT NULL,                     -- ms epoch
  state INTEGER NOT NULL DEFAULT 0,         -- ts-fsrs State: 0 new, 1 learning, 2 review, 3 relearning
  reps INTEGER NOT NULL DEFAULT 0,
  stability REAL,
  fsrs TEXT NOT NULL,                       -- full ts-fsrs card as JSON
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_card_due ON card(due);
CREATE INDEX IF NOT EXISTS ix_card_item ON card(item_id);

CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  state_before INTEGER NOT NULL,
  reviewed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_log_at ON review_log(reviewed_at);

CREATE TABLE IF NOT EXISTS text (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,            -- claude | paste | builtin
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  story_id INTEGER REFERENCES story(id) ON DELETE SET NULL,
  episode INTEGER
);

CREATE TABLE IF NOT EXISTS submission (
  id INTEGER PRIMARY KEY,
  modality TEXT NOT NULL DEFAULT 'write',   -- write | speak
  prompt TEXT,
  raw_text TEXT NOT NULL,
  corrected_text TEXT,
  summary TEXT,
  grader TEXT NOT NULL,                     -- claude
  score TEXT,                               -- JSON, reserved for graded tasks
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS error (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submission(id) ON DELETE CASCADE,
  start INTEGER NOT NULL,
  end INTEGER NOT NULL,
  original TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  category TEXT NOT NULL,
  explanation TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_error_at ON error(created_at);

CREATE TABLE IF NOT EXISTS gloss_cache (key TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS story (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT NOT NULL,
  bible TEXT NOT NULL,                     -- JSON {setting, characters: [{name, description}], premise}
  summary TEXT NOT NULL DEFAULT '',        -- rolling "story so far", one line per episode
  level TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE IF NOT EXISTS conversation (
  id INTEGER PRIMARY KEY,
  scenario TEXT NOT NULL,                  -- scenario id or "custom"
  title TEXT NOT NULL,
  setup TEXT NOT NULL,                     -- JSON: role, setting, goal, register
  level TEXT NOT NULL,
  messages TEXT NOT NULL DEFAULT '[]',     -- JSON [{role: "ai"|"me", text, corrections?, suggestion?}]
  submission_id INTEGER REFERENCES submission(id) ON DELETE SET NULL,  -- where its mistakes are logged
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE IF NOT EXISTS llm_usage (
  id INTEGER PRIMARY KEY,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`;

/** Additive migrations for databases created by older versions of this app (none yet). */
function migrate() {
  db.run("INSERT OR IGNORE INTO kv(key, value) VALUES ('app', '\"homeward\"')"); // marks our own files (see importBytes)
}

let SQL = null;
let db = null;
let saveTimer = null;

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet() {
  const conn = await idb();
  return new Promise((resolve, reject) => {
    const req = conn.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(bytes) {
  const conn = await idb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const hasIDB = () => typeof indexedDB !== "undefined";

/** Open the DB (from IndexedDB if present). `bytes` overrides, e.g. in tests. */
export async function openDb({ locateFile, bytes } = {}) {
  SQL ??= await globalThis.initSqlJs({ locateFile: locateFile || ((f) => `vendor/${f}`) });
  const stored = bytes ?? (hasIDB() ? await idbGet() : null);
  db = new SQL.Database(stored || undefined);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate();
  return db;
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
export const get = (sql, params = []) => all(sql, params)[0] ?? null;
export const scalar = (sql, params = []) => {
  const r = get(sql, params);
  return r ? Object.values(r)[0] : null;
};

/** Run a write; returns last insert id. Schedules a save. */
export function run(sql, params = []) {
  db.run(sql, params);
  const id = scalar("SELECT last_insert_rowid()");
  scheduleSave();
  return id;
}

export function tx(fn) {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    scheduleSave();
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function scheduleSave() {
  if (!hasIDB()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}
export async function saveNow() {
  clearTimeout(saveTimer);
  if (db && hasIDB()) await idbPut(db.export());
}

// ---- kv settings stored in the DB (backed up with it) ----
export const kvGet = (key, fallback = null) => {
  const v = scalar("SELECT value FROM kv WHERE key = ?", [key]);
  return v == null ? fallback : JSON.parse(v);
};
export const kvSet = (key, value) => run("INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, JSON.stringify(value)]);

// ---- backup / restore ----
export const exportBytes = () => db.export();

export async function importBytes(bytes) {
  const head = new TextDecoder().decode(bytes.slice(0, 15));
  if (head !== "SQLite format 3") throw new Error("That file isn't a SQLite database");
  const test = new SQL.Database(bytes);
  let ok = false;
  try {
    ok = test.exec("SELECT value FROM kv WHERE key = 'app'")[0]?.values[0]?.[0] === '"homeward"';
  } catch {}
  test.close();
  if (!ok) throw new Error("That file isn't a Homeward backup");
  db.close();
  db = new SQL.Database(bytes);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate();
  await saveNow();
}
