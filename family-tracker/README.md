# Family Tracker (SQLite edition)

Track chores, shopping, appointments, homework, bills, and pet care for a family.

- **Node.js + Express + EJS**: web app (all SQL written by hand with `better-sqlite3`)
- **Python (built-in `sqlite3`)**: schema/seed script (no pip packages needed)
- **SQLite**: one file, `family_tracker.db`

## Database

| Table | Purpose |
|---|---|
| `family_members(member_id PK, name, role, email)` | people |
| `categories(category_id PK, name, description)` | Chore, Shopping, Appointment... |
| `tasks(task_id PK, title, description, category_id FK, due_date, due_time, priority, status, estimated_minutes, location, created_at, completed_at)` | **main table** |
| `task_assignees(task_id FK, member_id FK, PK(task_id, member_id))` | many-to-many link |
| `task_details` (view) | task + category name + assignee names, used by the list and report |

Course concepts covered:
- **Indexes:** `tasks(due_date)`, `tasks(category_id)`, `tasks(status)`, `task_assignees(member_id)`
- **Transactions:** create/edit task + assignees (`db.transaction` in `server.js`)
- **Constraints:** CHECKs on priority, status, estimated minutes, and done-implies-completed_at; foreign keys with `ON DELETE CASCADE`
- **View:** `task_details`

### Differences from PostgreSQL you should know about
- **No stored procedures in SQLite.** The "mark done" logic is a function (`completeTask`) in `db.js` that runs a single atomic `UPDATE`. If your course requires a real stored procedure, either say so in your demo, or use PostgreSQL/MySQL. Ask your instructor if this counts.
- **Foreign keys are off by default in SQLite**, so `db.js` and `setup_db.py` run `PRAGMA foreign_keys = ON` on every connection.
- **Dates are text** (`YYYY-MM-DD`), which compare and sort correctly.
- **Not a client/server cloud database.** See deployment below.

## Run locally

```bash
python python/setup_db.py     # creates family_tracker.db with 80 sample tasks
npm install                   # needs Node 18+
npm start                     # http://localhost:8080
```

## Where the requirements live

- **Requirement 1** (add/edit/delete tasks + assignees): `server.js`, section "REQUIREMENT 1"; views `tasks.ejs`, `task_form.ejs`
- **Requirement 2** (filter report + stats): `server.js`, section "REQUIREMENT 2"; view `report.ejs`
- **Dynamic dropdowns/checkboxes:** `lookups()` in `server.js` queries `categories` and `family_members`

## Demo script (5-15 min)

1. Show `schema.sql` (PKs, FKs, constraints, indexes, view).
2. **Req 1:** create a task and tick two assignees, edit it (change assignees), delete it. Show rows with `sqlite3 family_tracker.db "SELECT * FROM task_assignees WHERE task_id = <id>;"`.
3. Show `lookups()` and the form template to prove the lists are built from the DB.
4. **Req 2:** run the report (e.g. category = Shopping, member = Maria). Note the stats. Mark a task done or edit one in Req 1, rerun, show the stats changed.
5. Show the report SQL (`@param IS NULL OR ...` pattern, `GROUP BY`, aggregates).
6. Extras: `EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE due_date BETWEEN '2026-10-01' AND '2026-10-31';` with and without `idx_tasks_due_date` (`DROP INDEX` / recreate; without it you will see `SCAN tasks`).

## Deploying to the cloud (optional +1%)

SQLite is a file, so the host needs a **persistent disk**. Google App Engine standard will not work (its filesystem is read-only/ephemeral). Use a **Compute Engine VM** (an e2-micro is enough):

1. Create the VM, allow HTTP traffic, install Node 18+ and Python 3.
2. Copy the project over (`gcloud compute scp --recurse` or `git clone`), then `npm install` and `python3 python/setup_db.py`.
3. Run with `PORT=80 node server.js` (or keep it alive with `pm2` / a systemd service, optionally behind nginx).
4. Confirm the public URL works. It must stay live **Dec 11 11:59 pm to Dec 23 11:59 pm, 2026**. Stop the VM afterward.

Check with your instructor whether a SQLite file on a VM counts as a "cloud database" for the course. If not, the fallback is Cloud SQL (PostgreSQL/MySQL), which would need the SQL rewritten.
