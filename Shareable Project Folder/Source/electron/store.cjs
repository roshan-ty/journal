const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
function openStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "journal.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS journal(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commands(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',result TEXT,created_at TEXT NOT NULL);",
  );
  return {
    db,
    read() {
      const r = db
        .prepare("SELECT revision,payload FROM journal WHERE id=1")
        .get();
      return r ? { revision: r.revision, state: JSON.parse(r.payload) } : null;
    },
    save(state, expected, {snapshot = true} = {}) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const old = db
          .prepare("SELECT revision,payload FROM journal WHERE id=1")
          .get();
        if (expected != null && (old?.revision || 0) !== expected)
          throw Error(
            "Journal changed during this edit. Reload and try again.",
          );
        const revision = (old?.revision || 0) + 1;
        if (old && snapshot)
          db.prepare(
            "INSERT INTO snapshots(created_at,payload) VALUES(?,?)",
          ).run(new Date().toISOString(), old.payload);
        db.prepare(
          "INSERT INTO journal(id,revision,payload) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload",
        ).run(revision, JSON.stringify(state));
        db.exec(
          "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 20)",
        );
        db.exec("COMMIT");
        return { revision, state };
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    close() {
      db.close();
    },
  };
}
module.exports = { openStore };
