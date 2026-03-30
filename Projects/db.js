const Database = require('better-sqlite3');

const db = new Database('urls.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    code      TEXT    NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    clicks    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

module.exports = db;
