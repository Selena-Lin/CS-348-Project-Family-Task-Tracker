-- Family Tracker schema (SQLite)
PRAGMA foreign_keys = ON;

DROP VIEW  IF EXISTS task_details;
DROP TABLE IF EXISTS task_assignees;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS family_members;

CREATE TABLE family_members (
    member_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL,                  -- parent, teen, child, ...
    email      TEXT UNIQUE
);

CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,          -- Chore, Shopping, Appointment...
    description TEXT
);

-- MAIN TABLE (Requirement 1)
-- Dates are stored as ISO-8601 text ('YYYY-MM-DD', 'HH:MM', 'YYYY-MM-DD HH:MM:SS'),
-- which sorts and compares correctly as plain text.
CREATE TABLE tasks (
    task_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title             TEXT NOT NULL,
    description       TEXT,
    category_id       INTEGER NOT NULL REFERENCES categories(category_id),
    due_date          TEXT NOT NULL,
    due_time          TEXT,
    priority          INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),  -- 1 = high
    status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'done')),
    estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
    location          TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at      TEXT,
    CONSTRAINT done_has_completion CHECK ((status = 'done') = (completed_at IS NOT NULL))
);

-- Many-to-many: a task can be assigned to several family members
CREATE TABLE task_assignees (
    task_id   INTEGER NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES family_members(member_id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, member_id)
);

-- Indexes chosen for the report filters and joins
CREATE INDEX idx_tasks_due_date   ON tasks(due_date);
CREATE INDEX idx_tasks_category   ON tasks(category_id);
CREATE INDEX idx_tasks_status     ON tasks(status);
CREATE INDEX idx_assignees_member ON task_assignees(member_id);  -- PK already covers task_id lookups

-- View used by the task list and the report: task + category name + assignee names
CREATE VIEW task_details AS
SELECT t.task_id, t.title, t.description, t.category_id, c.name AS category,
       t.due_date, t.due_time, t.priority, t.status, t.estimated_minutes,
       t.location, t.completed_at,
       COALESCE((SELECT group_concat(name, ', ')
                 FROM (SELECT m.name AS name
                       FROM task_assignees ta
                       JOIN family_members m ON m.member_id = ta.member_id
                       WHERE ta.task_id = t.task_id
                       ORDER BY m.name)), 'Unassigned') AS assignees
FROM tasks t
JOIN categories c ON c.category_id = t.category_id;

-- NOTE: SQLite has no stored procedures. The "mark done" logic lives in db.js (completeTask).
