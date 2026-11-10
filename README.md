# Family Tracker (SQLite edition)

Track chores, shopping, appointments, homework, bills, and pet care for a family.

- **Node.js + Express + EJS**: web app (all SQL written with `better-sqlite3`)
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

## Run locally

```bash
python python/setup_db.py     # creates family_tracker.db with 30 sample tasks
npm install                   # needs Node 18+
npm start                     # http://localhost:8080
```

## Where the requirements live

- **Requirement 1** (add/edit/delete tasks + assignees): `server.js`, section "REQUIREMENT 1"; views `tasks.ejs`, `task_form.ejs`
- **Requirement 2** (filter report + stats): `server.js`, section "REQUIREMENT 2"; view `report.ejs`
- **Dynamic dropdowns/checkboxes:** `lookups()` in `server.js` queries `categories` and `family_members`
