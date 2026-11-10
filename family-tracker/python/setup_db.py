"""Create the SQLite database file, apply schema.sql, and load sample data.

Usage:  python python/setup_db.py
Optional: set DB_PATH to put the database somewhere else.
No third-party packages needed (uses Python's built-in sqlite3).
"""
import os
import random
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = os.environ.get("DB_PATH", str(ROOT / "family_tracker.db"))

MEMBERS = [
    ("Maria", "parent", "maria@example.com"),
    ("David", "parent", "david@example.com"),
    ("Sofia", "teen", "sofia@example.com"),
    ("Lucas", "child", None),
    ("Grandma Rosa", "relative", "rosa@example.com"),
]

CATEGORIES = [
    ("Chore", "Cleaning, laundry, yard work"),
    ("Shopping", "Groceries and household supplies"),
    ("Appointment", "Doctor, dentist, school meetings"),
    ("Homework", "School assignments"),
    ("Bills", "Payments and paperwork"),
    ("Pets", "Feeding, vet, walks"),
]

# category -> (titles, location choices, minute range)
TEMPLATES = {
    "Chore": (["Do laundry", "Vacuum living room", "Take out trash", "Clean bathroom", "Mow lawn", "Wash dishes"],
              ["Home"], (15, 90)),
    "Shopping": (["Buy groceries", "Pick up milk and eggs", "Buy school supplies", "Get birthday gift", "Pharmacy run"],
                 ["Kroger", "Target", "Costco", "CVS"], (20, 75)),
    "Appointment": (["Dentist checkup", "Pediatrician visit", "Parent-teacher meeting", "Car service", "Eye exam"],
                    ["Dental Clinic", "Family Medical", "Elementary School", "Auto Shop"], (30, 120)),
    "Homework": (["Math worksheet", "Science project", "Reading log", "History essay"],
                 ["Home"], (20, 90)),
    "Bills": (["Pay electricity bill", "Renew car insurance", "Pay internet bill", "File tax documents"],
              ["Online"], (10, 45)),
    "Pets": (["Feed the dog", "Walk the dog", "Vet vaccination", "Clean litter box"],
             ["Home", "Happy Paws Vet"], (10, 60)),
}


def main():
    random.seed(42)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        conn.executescript((ROOT / "schema.sql").read_text())  # drops and recreates everything
        cur = conn.cursor()

        member_ids = []
        for m in MEMBERS:
            cur.execute("INSERT INTO family_members (name, role, email) VALUES (?,?,?)", m)
            member_ids.append(cur.lastrowid)

        cat_ids = {}
        for name, desc in CATEGORIES:
            cur.execute("INSERT INTO categories (name, description) VALUES (?,?)", (name, desc))
            cat_ids[name] = cur.lastrowid

        today = date.today()
        for _ in range(80):
            cat = random.choice(list(TEMPLATES))
            titles, locations, (lo, hi) = TEMPLATES[cat]
            due = today + timedelta(days=random.randint(-45, 30))
            status = random.choice(["open", "in_progress", "done", "done"])
            if due > today and status == "done":
                status = "open"
            completed = None
            if status == "done":
                completed = (datetime.combine(due, datetime.min.time())
                             + timedelta(days=random.randint(-2, 3), hours=random.randint(8, 20))
                             ).strftime("%Y-%m-%d %H:%M:%S")
            cur.execute(
                """INSERT INTO tasks (title, category_id, due_date, due_time, priority, status,
                                      estimated_minutes, location, completed_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (random.choice(titles), cat_ids[cat], due.isoformat(),
                 f"{random.randint(7, 20):02d}:00", random.randint(1, 3), status,
                 random.randrange(lo, hi + 1, 5), random.choice(locations), completed),
            )
            task_id = cur.lastrowid
            for mid in random.sample(member_ids, random.randint(1, 2)):
                cur.execute("INSERT INTO task_assignees (task_id, member_id) VALUES (?,?)", (task_id, mid))

        conn.commit()
        print(f"Created {DB_PATH} (5 members, 6 categories, 80 tasks).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
