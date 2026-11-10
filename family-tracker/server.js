const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
const nz = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const num = (v) => (nz(v) === null ? null : Number(v));
const toIntArray = (v) =>
  [...new Set((v === undefined ? [] : [].concat(v)).map(Number).filter(Number.isInteger))];

// Dropdown / checkbox data always comes from the database (never hard-coded)
function lookups() {
  return {
    categories: db.prepare('SELECT category_id, name FROM categories ORDER BY name').all(),
    members: db.prepare('SELECT member_id, name FROM family_members ORDER BY name').all(),
  };
}

// Task fields from a submitted form, as named parameters
function taskFields(b) {
  return {
    title: String(b.title).trim(), description: nz(b.description), category_id: Number(b.category_id),
    due_date: b.due_date, due_time: nz(b.due_time), priority: Number(b.priority), status: b.status,
    estimated_minutes: num(b.estimated_minutes), location: nz(b.location),
  };
}

const insertAssignee = db.prepare('INSERT INTO task_assignees (task_id, member_id) VALUES (?, ?)');

// ---------- REQUIREMENT 1: create / read / update / delete tasks ----------
app.get('/', (req, res) => res.redirect('/tasks'));

// READ: every task with its assignees (the task_details view does the joins)
app.get('/tasks', (req, res) => {
  const tasks = db.prepare(`
    SELECT task_id, title, category, priority, status, due_date, due_time, assignees
    FROM task_details ORDER BY due_date DESC, task_id DESC`).all();
  res.render('tasks', { tasks });
});

app.get('/tasks/new', (req, res) => {
  res.render('task_form', { ...lookups(), task: null, selected: [], action: '/tasks', heading: 'New task' });
});

// CREATE: task row + assignee rows in ONE transaction (auto-rollback if anything throws)
const createTask = db.transaction((fields, assignees) => {
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO tasks (title, description, category_id, due_date, due_time, priority,
                       status, estimated_minutes, location, completed_at)
    VALUES (@title, @description, @category_id, @due_date, @due_time, @priority,
            @status, @estimated_minutes, @location,
            CASE WHEN @status = 'done' THEN datetime('now') END)`).run(fields);
  assignees.forEach((m) => insertAssignee.run(lastInsertRowid, m));
});

app.post('/tasks', (req, res) => {
  createTask(taskFields(req.body), toIntArray(req.body.assignees));
  res.redirect('/tasks');
});

app.get('/tasks/:id/edit', (req, res) => {
  const task = db.prepare(`
    SELECT task_id, title, description, category_id, due_date, due_time, priority, status,
           estimated_minutes, location
    FROM tasks WHERE task_id = ?`).get(req.params.id);
  if (!task) return res.status(404).send('Task not found');
  const selected = db.prepare('SELECT member_id FROM task_assignees WHERE task_id = ?')
    .all(req.params.id).map((r) => r.member_id);
  res.render('task_form', {
    ...lookups(), task, selected, action: `/tasks/${req.params.id}/edit`, heading: 'Edit task',
  });
});

// UPDATE: task row, then replace its assignee rows, in ONE transaction
const updateTask = db.transaction((id, fields, assignees) => {
  db.prepare(`
    UPDATE tasks
    SET title = @title, description = @description, category_id = @category_id,
        due_date = @due_date, due_time = @due_time, priority = @priority, status = @status,
        estimated_minutes = @estimated_minutes, location = @location,
        completed_at = CASE WHEN @status = 'done' THEN COALESCE(completed_at, datetime('now')) END
    WHERE task_id = @id`).run({ ...fields, id });
  db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(id);
  assignees.forEach((m) => insertAssignee.run(id, m));
});

app.post('/tasks/:id/edit', (req, res) => {
  updateTask(Number(req.params.id), taskFields(req.body), toIntArray(req.body.assignees));
  res.redirect('/tasks');
});

// DELETE: assignee rows are removed by ON DELETE CASCADE
app.post('/tasks/:id/delete', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE task_id = ?').run(req.params.id);
  res.redirect('/tasks');
});

app.post('/tasks/:id/complete', (req, res) => {
  db.completeTask(Number(req.params.id));
  res.redirect('/tasks');
});


// ---------- REQUIREMENT 2: filterable report with statistics ----------
app.get('/report', (req, res) => {
  const filters = {
    from: nz(req.query.from), to: nz(req.query.to), category: nz(req.query.category),
    member: nz(req.query.member), status: nz(req.query.status),
  };
  const submitted = Object.keys(req.query).length > 0;
  const data = { ...lookups(), filters, submitted, rows: [], stats: null, byCategory: [] };

  if (submitted) {
    // Optional filters: a NULL parameter means "don't filter on this"
    const where = `
      WHERE (@date_from IS NULL OR d.due_date >= @date_from)
        AND (@date_to   IS NULL OR d.due_date <= @date_to)
        AND (@category  IS NULL OR d.category_id = @category)
        AND (@status    IS NULL OR d.status = @status)
        AND (@member    IS NULL OR EXISTS (SELECT 1 FROM task_assignees x
                                           WHERE x.task_id = d.task_id AND x.member_id = @member))`;
    const params = {
      date_from: filters.from, date_to: filters.to, category: num(filters.category),
      status: filters.status, member: num(filters.member),
    };

    data.rows = db.prepare(`
      SELECT d.task_id, d.title, d.category, d.priority, d.status, d.due_date,
             d.estimated_minutes, d.assignees
      FROM task_details d ${where}
      ORDER BY d.due_date, d.priority`).all(params);

    data.stats = db.prepare(`
      SELECT COUNT(*)                                             AS total,
             COALESCE(SUM(d.status = 'done'), 0)                  AS done,
             ROUND(100.0 * SUM(d.status = 'done') / NULLIF(COUNT(*), 0), 1) AS completion_rate,
             ROUND(AVG(d.estimated_minutes), 1)                   AS avg_minutes,
             ROUND(AVG(julianday(date(d.completed_at)) - julianday(d.due_date)), 1) AS avg_days_vs_due
      FROM task_details d ${where}`).get(params);

    data.byCategory = db.prepare(`
      SELECT d.category, COUNT(*) AS total, SUM(d.status = 'done') AS done,
             SUM(COALESCE(d.estimated_minutes, 0)) AS total_minutes
      FROM task_details d ${where}
      GROUP BY d.category ORDER BY total DESC`).all(params);
  }
  res.render('report', data);
});

// ---------- errors ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`Something went wrong: ${err.message}`);
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Family Tracker running on http://localhost:${port}`));
