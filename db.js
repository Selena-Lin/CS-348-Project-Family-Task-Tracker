const Database = require('better-sqlite3');
const path = require('path');

// Run `python python/setup_db.py` first to create the file.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'family_tracker.db');
const db = new Database(dbPath, { fileMustExist: true });

db.pragma('foreign_keys = ON'); // SQLite leaves FK enforcement off unless asked, per connection

// Mark a task done (SQLite has no stored procedures, so this lives in app code).
// Returns true if the task was changed.
db.completeTask = (taskId) =>
  db.prepare(`UPDATE tasks SET status = 'done', completed_at = datetime('now')
              WHERE task_id = ? AND status <> 'done'`).run(taskId).changes === 1;

module.exports = db;
