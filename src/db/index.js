const { dirname } = require('path');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const initSqlJs = require('sql.js');

let db = null;
let dbPath = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  dbPath = process.env.DB_PATH || './data/fams.db';

  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = existsSync(dbPath)
    ? new SQL.Database(readFileSync(dbPath))
    : new SQL.Database();

  initSchema();
  return db;
}

function save() {
  if (!db || !dbPath) return;
  writeFileSync(dbPath, Buffer.from(db.export()));
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS processed_requests (
      work_item_id     TEXT PRIMARY KEY,
      work_item_pid    TEXT,
      project_id       INTEGER,
      state_id         INTEGER,
      title            TEXT,
      biz_id           TEXT,
      account_manager  TEXT,
      discussion_added INTEGER DEFAULT 0,
      label_added      INTEGER DEFAULT 0,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS poll_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      polled_at       TEXT NOT NULL,
      new_count       INTEGER DEFAULT 0,
      processed_count INTEGER DEFAULT 0,
      total_found     INTEGER DEFAULT 0,
      error           TEXT
    )
  `);
  save();
}

/** Returns first matching row as plain object, or null */
function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const found = stmt.step();
  const row = found ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

/** Returns all matching rows as array of plain objects */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/** Returns the row if already tracked, otherwise null */
function isProcessed(workItemId) {
  return queryOne(
    'SELECT work_item_id, discussion_added, label_added FROM processed_requests WHERE work_item_id = ?',
    [workItemId]
  );
}

function upsertRequest(req) {
  const now = new Date().toISOString();
  db.run(`
    INSERT INTO processed_requests
      (work_item_id, work_item_pid, project_id, state_id, title, biz_id,
       account_manager, discussion_added, label_added, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(work_item_id) DO UPDATE SET
      state_id         = excluded.state_id,
      biz_id           = excluded.biz_id,
      account_manager  = excluded.account_manager,
      discussion_added = excluded.discussion_added,
      label_added      = excluded.label_added,
      updated_at       = excluded.updated_at
  `, [
    req.workItemId, req.workItemPId, req.projectId, req.stateId, req.title,
    req.bizId, req.accountManager,
    req.discussionAdded ? 1 : 0, req.labelAdded ? 1 : 0,
    now, now,
  ]);
  save();
}

function logPoll({ newCount = 0, processedCount = 0, totalFound = 0, error = null } = {}) {
  db.run(
    'INSERT INTO poll_log (polled_at, new_count, processed_count, total_found, error) VALUES (?, ?, ?, ?, ?)',
    [new Date().toISOString(), newCount, processedCount, totalFound, error]
  );
  save();
}

function getStats() {
  return queryOne(`
    SELECT COUNT(*) as total,
           SUM(discussion_added) as discussions,
           SUM(label_added) as labels
    FROM processed_requests
  `) || { total: 0, discussions: 0, labels: 0 };
}

function getRecentPolls(limit = 20) {
  return queryAll('SELECT * FROM poll_log ORDER BY id DESC LIMIT ?', [limit]);
}

module.exports = {
  getDb, isProcessed, upsertRequest, logPoll,
  getStats, getRecentPolls, queryOne, queryAll,
};
