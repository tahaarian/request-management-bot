function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_item_id INTEGER NOT NULL UNIQUE,
      work_item_pid INTEGER,
      project_id INTEGER,
      state_id INTEGER,
      title TEXT,
      biz_id TEXT,
      account_manager TEXT,
      discussion_added INTEGER DEFAULT 0,
      label_added INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS poll_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      polled_at TEXT DEFAULT (datetime('now')),
      new_count INTEGER DEFAULT 0,
      processed_count INTEGER DEFAULT 0,
      error TEXT
    );
  `);
}

module.exports = { runMigrations };
