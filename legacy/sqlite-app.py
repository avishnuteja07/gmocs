#!/usr/bin/env python3
"""Small local login app for Madanapalle Institute of Technology & Science."""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import random
import re
import secrets
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
DB = ROOT / "data" / "users.sqlite3"
STATIC = ROOT / "static"
ITERATIONS = 310_000
REGNO_RE = re.compile(r"^(2[456])\s*MRA\s*(05)\s*(\d{3})$", re.I)
QUIZ_SECONDS = 15 * 60
LEVEL_SECONDS = {1: 15 * 60, 2: 25 * 60}
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "MITSAdmin@2026"
TASKS = [
    {"id": "c", "title": "Task 1 · C", "questions": [
        {"id": "c-1", "prompt": "The program should print the sum of digits of 1234 (expected 10) but prints 1. Fix it.", "code": "int n = 1234, sum = 0;\nwhile (n > 0) {\n    sum = n % 10;\n    n = n / 10;\n}\nprintf(\"%d\", sum);"},
        {"id": "c-2", "prompt": "Expected output is 25, but the program prints 11.", "code": "#define SQUARE(x) x*x\nprintf(\"%d\", SQUARE(2+3));"},
        {"id": "c-3", "prompt": "The program should print the largest element (-1), but prints 0.", "code": "int a[5] = {-4, -8, -1, -9, -3}, max = 0;\nfor (int i = 0; i < 5; i++)\n    if (a[i] > max) max = a[i];\nprintf(\"%d\", max);"},
        {"id": "c-4", "prompt": "This sometimes prints garbage after hello.", "code": "char s[5] = \"hello\";\nprintf(\"%s\", s);"},
        {"id": "c-5", "prompt": "Expected output is 6, but it prints 5.", "code": "void increment(int x) { x++; }\nint main() {\n    int a = 5;\n    increment(a);\n    printf(\"%d\", a);\n}"},
    ]},
    {"id": "dsa", "title": "Task 2 · DSA Using C", "questions": [
        {"id": "dsa-1", "prompt": "The function should reverse the array, but the array stays unchanged. Fix it.", "code": "for (i = 0; i < n; i++) {\n    t = a[i];\n    a[i] = a[n - 1 - i];\n    a[n - 1 - i] = t;\n}"},
        {"id": "dsa-2", "prompt": "This selection sort gives wrong results. Fix the bug.", "code": "for (i = 0; i < n - 1; i++) {\n    min = i;\n    for (j = i + 1; j < n; j++)\n        if (a[j] < a[min]) min = a[j];\n    temp = a[i]; a[i] = a[min]; a[min] = temp;\n}"},
        {"id": "dsa-3", "prompt": "For a = {1, 3} and key = 5, this binary search never terminates. Fix the bounds updates.", "code": "low = 0; high = n - 1;\nwhile (low <= high) {\n    mid = (low + high) / 2;\n    if (a[mid] == key) return mid;\n    else if (a[mid] < key) low = mid;\n    else high = mid;\n}\nreturn -1;"},
        {"id": "dsa-4", "prompt": "With MAX = 5 and top = -1, the 5th push writes outside the array. Fix the overflow check.", "code": "void push(int x) {\n    if (top == MAX)\n        printf(\"Overflow\");\n    else\n        stack[++top] = x;\n}"},
        {"id": "dsa-5", "prompt": "After running this, the linked list 1→2→3 is reduced to just node 1. Fix the reversal.", "code": "struct Node *prev = NULL, *cur = head, *next;\nwhile (cur) {\n    cur->next = prev;\n    prev = cur;\n    cur = cur->next;\n}\nhead = prev;"},
    ]},
    {"id": "python", "title": "Task 3 · Python", "questions": [
        {"id": "python-1", "prompt": "The goal is to change b without affecting a, but a also changes. Fix it.", "code": "a = [1, 2, 3]\nb = a\nb.append(4)\nprint(a)"},
        {"id": "python-2", "prompt": "Only the first row should change, but all rows change. Fix it.", "code": "matrix = [[0] * 3] * 3\nmatrix[0][0] = 1\nprint(matrix)"},
        {"id": "python-3", "prompt": "count_vowels(\"sky\") should return 0 but returns 3. Fix the condition.", "code": "def count_vowels(s):\n    count = 0\n    for ch in s:\n        if ch == 'a' or 'e' or 'i' or 'o' or 'u':\n            count += 1\n    return count"},
        {"id": "python-4", "prompt": "Calling update() crashes with UnboundLocalError. Fix it so x becomes 15.", "code": "x = 10\ndef update():\n    x = x + 5\nupdate()\nprint(x)"},
        {"id": "python-5", "prompt": "The goal is a dictionary of word → length for all 3 words, but only 2 entries appear. Fix it.", "code": "words = [\"apple\", \"bat\", \"cat\"]\nlengths = {}\nfor w in words:\n    lengths[len(w)] = w\nprint(lengths)"},
    ]},
    {"id": "dbms", "title": "Task 4 · DBMS", "questions": [
        {"id": "dbms-1", "prompt": "The query should list each department with its number of employees, but it throws an error. Fix it.", "code": "SELECT name, dept, COUNT(*)\nFROM emp\nGROUP BY dept;"},
        {"id": "dbms-2", "prompt": "The query should list employees earning above the average salary, but it throws an error. Fix it.", "code": "SELECT name FROM emp WHERE salary > AVG(salary);"},
        {"id": "dbms-3", "prompt": "The query should show all employees whose salary is above 30000, but it throws a syntax error. Fix it.", "code": "SELECT name salary\nFROM emp\nWHERE salary > 30000;"},
        {"id": "dbms-4", "prompt": "The query should return employees who have no phone number recorded, but it returns nothing. Fix it.", "code": "SELECT * FROM emp WHERE phone = NULL;"},
        {"id": "dbms-5", "prompt": "The query should show the highest salary in each department along with the department name, but it throws an error. Fix it.", "code": "SELECT dept, MAX(salary)\nFROM emp\nWHERE MAX(salary) > 40000\nGROUP BY dept;"},
    ]},
]

LEVEL2_TASKS = [
    {"id": "css", "title": "Task 1 · CSS Profile Card", "questions": [{"id": "css-1", "prompt": "Write CSS in the blank style block to pass all five checks: center .container with flex in both directions and full-screen height; make .card 250px wide with 20px padding and centered text; give the card a 2px solid #333 border and 10px radius; make .title #1a73e8 and .role #666 italic; style .btn with blue background, white text, no border, 5px radius and 8px padding.", "code": "<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { margin: 0; }\n    /* WRITE YOUR CSS HERE */\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <div class=\"card\">\n      <h2 class=\"title\">Alex</h2>\n      <p class=\"role\">Web Developer</p>\n      <button class=\"btn\">Follow</button>\n    </div>\n  </div>\n</body>\n</html>"}]},
    {"id": "express", "title": "Task 2 · Express Students API", "questions": [{"id": "express-1", "prompt": "Complete the Express routes. Pass the listed tests: GET /students returns all students; ?pass=true returns marks >= 50; GET /students/:id returns one student or 404 { error: \"Not found\" }; POST validates a non-empty name and numeric marks from 0–100, returns 400 { error: \"Invalid data\" } for invalid input, or 201 with the next id (4 for Kiran).", "code": "const express = require(\"express\");\nconst app = express();\napp.use(express.json());\n\nlet students = [\n  { id: 1, name: \"Ravi\", marks: 80 },\n  { id: 2, name: \"Sita\", marks: 92 },\n  { id: 3, name: \"Arun\", marks: 45 }\n];\n\n// WRITE YOUR ROUTES HERE\n\nmodule.exports = app;\nif (require.main === module) app.listen(3000);"}]},
    {"id": "react", "title": "Task 3 · React Shopping Cart", "questions": [{"id": "react-1", "prompt": "Write the state and functions inside App. Pass the tests: an empty cart totals ₹0; adding a product creates quantity 1; adding it again increases quantity; plus/minus changes quantity; quantity is capped at 5; quantity 0 removes the item; total is the sum of price × quantity.", "code": "import { useState } from \"react\";\n\nconst products = [\n  { id: 1, name: \"Pen\", price: 10 },\n  { id: 2, name: \"Book\", price: 50 },\n  { id: 3, name: \"Bag\", price: 200 }\n];\n\nexport default function App() {\n  // WRITE STATE, addToCart, changeQty, AND total HERE\n\n  return (\n    <div>\n      <h2>Products</h2>\n      {products.map(p => (\n        <div key={p.id}>\n          <span>{p.name} - ₹{p.price}</span>\n          <button onClick={() => addToCart(p)}>Add {p.name}</button>\n        </div>\n      ))}\n      <h2>Cart</h2>\n      {cart.length === 0 && <p>Cart is empty</p>}\n      {cart.map(item => (\n        <div key={item.id}>\n          <span>{item.name} x {item.qty}</span>\n          <button onClick={() => changeQty(item.id, 1)}>+{item.name}</button>\n          <button onClick={() => changeQty(item.id, -1)}>-{item.name}</button>\n        </div>\n      ))}\n      <p data-testid=\"total\">Total: ₹{total}</p>\n    </div>\n  );\n}"}]},
]

LEVEL2_ANSWER_TEXT = {
    "css-1": "Center the container with flexbox and min-height: 100vh; apply the specified card dimensions, border, text colors, italic role, and blue button styles.",
    "express-1": "Implement GET /students with an optional pass filter, GET /students/:id with a 404 response, and validated POST /students with incrementing IDs and status 201.",
    "react-1": "Use cart state and immutable state updates; increment existing items up to quantity 5, remove items at zero, and reduce price × quantity for the total.",
}

LEVEL2_PATTERNS = {
    "css-1": [r"\.container\{[^}]*display:flex", r"justify-content:center", r"align-items:center", r"(?:min-height|height):100vh", r"\.card\{[^}]*width:250px", r"padding:20px", r"text-align:center", r"border:2pxsolid#333", r"border-radius:10px", r"\.title\{[^}]*color:#1a73e8", r"\.role\{[^}]*color:#666", r"font-style:italic", r"\.btn\{[^}]*background(?:-color)?:(?:blue|#1a73e8|#007bff|#00f)", r"color:white", r"border:none", r"border-radius:5px", r"padding:8px"],
    "express-1": [r"app\.get\(['\"]\/students['\"]", r"req\.query\.pass", r"marks\s*>=\s*50", r"app\.get\(['\"]\/students\/:id['\"]", r"req\.params\.id", r"notfound", r"app\.post\(['\"]\/students['\"]", r"name\.trim\(\)", r"marks", r"status\(400\)", r"invaliddata", r"status\(201\)", r"students\.push", r"students\.length\s*\+\s*1"],
    "react-1": [r"usestate", r"const\[cart,setcart\]", r"(?:functionaddtocart|constaddtocart=)", r"(?:functionchangeqty|constchangeqty=)", r"setcart", r"\.filter\(", r"\.map\(", r"qty", r"math\.min", r"5", r"price", r"reduce\("],
}

ANSWER_PATTERNS = {
    "c-1": [r"sum\+=n%10", r"sum=sum\+n%10"],
    "c-2": [r"#definesquare\(x\)\(\(x\)\*\(x\)\)"],
    "c-3": [r"max=a\[0\]", r"max=int_min"],
    "c-4": [r"char s\[6\]", r"char s\[\]=\"hello\""],
    "c-5": [r"voidincrement\(int\*x\)", r"increment\(&a\)"],
    "dsa-1": [r"i<n/2"],
    "dsa-2": [r"min=j"],
    "dsa-3": [r"low=mid\+1", r"high=mid-1"],
    "dsa-4": [r"top==max-1", r"top>=max-1"],
    "dsa-5": [r"next=cur->next", r"cur->next=prev", r"cur=next"],
    "python-1": [r"b=a\.copy\(\)", r"b=list\(a\)"],
    "python-2": [r"\[\[0\]\*3for\w+inrange\(3\)\]"],
    "python-3": [r"chinastring\.ascii_lowercase", r"ifchin[\"']aeiou[\"']"],
    "python-4": [r"globalx", r"x=x\+5"],
    "python-5": [r"lengths\[w\]=len\(w\)"],
    "dbms-1": [r"selectdept,count\(\*\)fromempgroupbydept", r"selectdept,count\(\*\)as\w+fromempgroupbydept"],
    "dbms-2": [r"salary>\(selectavg\(salary\)fromemp\)"],
    "dbms-3": [r"selectname,salaryfromemp"],
    "dbms-4": [r"phoneisnull"],
    "dbms-5": [r"groupbydepthavingmax\(salary\)>40000", r"groupbydepthavingmax\(salary\)>=40001"],
}

ANSWER_TEXT = {
    "c-1": "Use sum += n % 10; so each digit is accumulated.",
    "c-2": "Use #define SQUARE(x) ((x) * (x)) so the argument is evaluated safely.",
    "c-3": "Initialize max from a[0] (or INT_MIN) so all-negative arrays work.",
    "c-4": "Use char s[6] = \"hello\"; to leave room for the null terminator.",
    "c-5": "Pass the address: increment(int *x), update *x, and call increment(&a).",
    "dsa-1": "Only loop while i < n / 2 so each pair is swapped once.",
    "dsa-2": "Assign min = j when a[j] is smaller.",
    "dsa-3": "Advance the bounds with low = mid + 1 and high = mid - 1.",
    "dsa-4": "Check top >= MAX - 1 before pushing into a MAX-element array.",
    "dsa-5": "Save next = cur->next before changing cur->next, then advance cur = next.",
    "python-1": "Copy the list with b = a.copy() (or b = list(a)).",
    "python-2": "Build independent rows with [[0] * 3 for _ in range(3)].",
    "python-3": "Test membership with if ch in \"aeiou\":.",
    "python-4": "Declare global x inside update() before changing it.",
    "python-5": "Use lengths[w] = len(w) so every word is a separate key.",
    "dbms-1": "Select dept, COUNT(*) and GROUP BY dept; do not select an ungrouped employee name.",
    "dbms-2": "Compare salary with a subquery: salary > (SELECT AVG(salary) FROM emp).",
    "dbms-3": "Add the missing comma: SELECT name, salary FROM emp ...",
    "dbms-4": "Use WHERE phone IS NULL.",
    "dbms-5": "Move the aggregate condition to HAVING after GROUP BY dept.",
}


def normalize_answer(value: str) -> str:
    return re.sub(r"\s+", "", value.casefold())


def answer_is_correct(question_id: str, answer: str) -> bool:
    normalized = normalize_answer(answer)
    if question_id in LEVEL2_PATTERNS:
        return all(re.search(pattern, normalized) for pattern in LEVEL2_PATTERNS[question_id])
    patterns = ANSWER_PATTERNS.get(question_id, [])
    if question_id == "c-1":
        return any(re.search(pattern, normalized) for pattern in patterns)
    if question_id == "c-5":
        changes_value = any(re.search(pattern, normalized) for pattern in (r"\(\*x\)\+\+", r"\+\+\(\*x\)", r"\*x\+=1", r"\*x=\*x\+1"))
        return all(re.search(pattern, normalized) for pattern in patterns) and changes_value
    if question_id == "dsa-3":
        return all(re.search(pattern, normalized) for pattern in patterns)
    if question_id == "dsa-5":
        positions = [normalized.find(pattern) for pattern in ("next=cur->next", "cur->next=prev", "cur=next")]
        return min(positions) >= 0 and positions == sorted(positions)
    if question_id == "python-4":
        return bool(re.search(r"globalx", normalized))
    if question_id == "dbms-1":
        return any(re.search(pattern, normalized) for pattern in patterns)
    if question_id == "dbms-2":
        return any(re.search(pattern, normalized) for pattern in patterns)
    return any(re.search(pattern, normalized) for pattern in patterns)


def normalize_regno(value: str) -> str | None:
    value = value.strip()
    if re.fullmatch(r"\d{8}", value):
        return value
    match = REGNO_RE.fullmatch(value)
    return f"{match.group(1)}MRA{match.group(2)}{match.group(3)}" if match else None


def registration_year(regno: str) -> int | None:
    return {"26": 1, "25": 2, "24": 3}.get(regno[:2]) if "MRA05" in regno else None


def connect() -> sqlite3.Connection:
    DB.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            registration_number TEXT NOT NULL UNIQUE,
            full_name TEXT,
            password_salt BLOB NOT NULL,
            password_hash BLOB NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            study_year INTEGER,
            expires_at INTEGER NOT NULL,
            last_seen INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_salt BLOB NOT NULL,
            password_hash BLOB NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS admin_sessions (
            token_hash TEXT PRIMARY KEY,
            admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS attempts (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            study_year INTEGER NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            started_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            questions_json TEXT NOT NULL,
            answers_json TEXT NOT NULL DEFAULT '{}',
            grades_json TEXT NOT NULL DEFAULT '{}',
            submitted_at INTEGER,
            submit_reason TEXT
        );
    """)
    user_columns = {row["name"] for row in db.execute("PRAGMA table_info(users)")}
    if "study_year" not in user_columns:
        db.execute("ALTER TABLE users ADD COLUMN study_year INTEGER")
    if "full_name" not in user_columns:
        db.execute("ALTER TABLE users ADD COLUMN full_name TEXT")
    session_columns = {row["name"] for row in db.execute("PRAGMA table_info(sessions)")}
    if "study_year" not in session_columns:
        db.execute("ALTER TABLE sessions ADD COLUMN study_year INTEGER")
    if "last_seen" not in session_columns:
        db.execute("ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0")
    attempt_columns = {row["name"] for row in db.execute("PRAGMA table_info(attempts)")}
    if "level" not in attempt_columns:
        db.execute("ALTER TABLE attempts ADD COLUMN level INTEGER NOT NULL DEFAULT 1")
    if "grades_json" not in attempt_columns:
        db.execute("ALTER TABLE attempts ADD COLUMN grades_json TEXT NOT NULL DEFAULT '{}'")
    if not db.execute("SELECT 1 FROM admins LIMIT 1").fetchone():
        salt = secrets.token_bytes(16)
        db.execute("INSERT INTO admins(username,password_salt,password_hash,created_at) VALUES(?,?,?,?)", (DEFAULT_ADMIN_USERNAME, salt, password_digest(DEFAULT_ADMIN_PASSWORD, salt), int(time.time())))
    db.commit()
    return db


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)


class Handler(BaseHTTPRequestHandler):
    server_version = "MITLogin/1.0"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def send_bytes(self, body: bytes, content_type: str, status=200, extra_headers=()):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        for key, value in extra_headers:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def json(self, obj, status=200, headers=()):
        self.send_bytes(json.dumps(obj).encode(), "application/json; charset=utf-8", status, headers)

    def body_json(self):
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 8192)
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return {}

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/api/admin/me":
            return self.json({"authenticated": bool(self.current_admin())})
        if path == "/api/admin/dashboard":
            if not self.current_admin():
                return self.json({"error": "Administrator sign in required."}, 401)
            try:
                level = int(parse_qs(urlparse(self.path).query).get("level", ["1"])[0])
            except ValueError:
                level = 1
            if level not in LEVEL_SECONDS:
                level = 1
            return self.admin_dashboard(level)
        if path == "/api/me":
            user = self.current_user()
            return self.json({"authenticated": bool(user), "registrationNumber": user["registration_number"] if user else None, "fullName": user["full_name"] if user else None, "studyYear": user["study_year"] if user else None})
        if path == "/api/leaderboard":
            try:
                level = int(parse_qs(urlparse(self.path).query).get("level", ["1"])[0])
            except ValueError:
                level = 1
            if level not in LEVEL_SECONDS:
                level = 1
            db = connect()
            rows = db.execute("SELECT u.full_name, u.registration_number, a.study_year, a.level, a.started_at, a.submitted_at, a.grades_json FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.submitted_at IS NOT NULL AND a.level=? ORDER BY a.submitted_at DESC", (level,)).fetchall()
            db.close()
            results = []
            for row in rows:
                grades = json.loads(row["grades_json"] or "{}")
                if not grades:
                    continue
                unit = 10 if row["level"] == 2 else 5
                results.append({"name": row["full_name"] or row["registration_number"], "studyYear": row["study_year"], "level": row["level"], "correct": sum(bool(value) for value in grades.values()), "score": sum(unit for value in grades.values() if value), "seconds": max(0, row["submitted_at"] - row["started_at"]), "submittedAt": row["submitted_at"]})
            results.sort(key=lambda result: (-result["score"], result["seconds"], result["submittedAt"]))
            return self.json({"leaderboard": results[:50]})
        if path == "/api/attempt":
            user = self.current_user()
            if not user:
                return self.json({"error": "Sign in first."}, 401)
            db = connect()
            requested_level = parse_qs(urlparse(self.path).query).get("level", [None])[0]
            if requested_level and requested_level in ("1", "2"):
                attempt = db.execute("SELECT * FROM attempts WHERE user_id=? AND study_year=? AND level=? AND submitted_at IS NULL ORDER BY started_at DESC LIMIT 1", (user["id"], user["study_year"], int(requested_level))).fetchone()
            else:
                attempt = db.execute("SELECT * FROM attempts WHERE user_id=? AND study_year=? AND submitted_at IS NULL ORDER BY started_at DESC LIMIT 1", (user["id"], user["study_year"])).fetchone()
            db.close()
            if not attempt:
                return self.json({"attempt": None})
            if int(time.time()) >= attempt["expires_at"]:
                return self.json({"attempt": {"id": attempt["id"], "level": attempt["level"], "expiresAt": attempt["expires_at"], "tasks": json.loads(attempt["questions_json"]), "answers": json.loads(attempt["answers_json"]), "submitted": True}})
            return self.json({"attempt": {"id": attempt["id"], "level": attempt["level"], "expiresAt": attempt["expires_at"], "tasks": json.loads(attempt["questions_json"]), "answers": json.loads(attempt["answers_json"]), "submitted": False}})
        if path == "/":
            path = "/index.html"
        target = (STATIC / path.lstrip("/")).resolve()
        if not target.is_relative_to(STATIC.resolve()) or not target.is_file():
            return self.send_bytes(b"Not found", "text/plain", 404)
        types = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml"}
        self.send_bytes(target.read_bytes(), types.get(target.suffix.lower(), "application/octet-stream"))

    def current_user(self):
        cookies = self.headers.get("Cookie", "")
        token = next((part.strip()[12:] for part in cookies.split(";") if part.strip().startswith("mits_l1_sid=")), None)
        if not token:
            return None
        db = connect()
        now = int(time.time())
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db.execute("UPDATE sessions SET last_seen=? WHERE token_hash=? AND expires_at>?", (now, token_hash, now))
        db.commit()
        row = db.execute("SELECT u.id, u.registration_number, u.full_name, s.study_year FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?", (token_hash, now)).fetchone()
        db.close()
        return row

    def current_admin(self):
        cookies = self.headers.get("Cookie", "")
        token = next((part.strip()[14:] for part in cookies.split(";") if part.strip().startswith("mits_l1_admin=")), None)
        if not token:
            return None
        db = connect()
        row = db.execute("SELECT a.id, a.username FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?", (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
        db.close()
        return row

    def admin_dashboard(self, level=1):
        db = connect()
        users = db.execute("SELECT id,full_name,registration_number,study_year FROM users").fetchall()
        attempts = db.execute("SELECT a.*,u.full_name,u.registration_number FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.level=? ORDER BY a.started_at DESC", (level,)).fetchall()
        active_sessions = db.execute("SELECT DISTINCT u.id,u.study_year,u.registration_number FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires_at>? AND s.last_seen>?", (int(time.time()), int(time.time()) - 45)).fetchall()
        db.close()
        cohorts = {year: {"registered": 0, "loggedIn": 0, "attempted": 0, "completed": 0, "inProgress": 0, "questionCounts": {str(n): 0 for n in range(1, 5)}} for year in (1, 2, 3)}
        cohort_users = {year: {"attempted": set(), "completed": set(), "inProgress": set(), "questions": {n: set() for n in range(1, 5)}} for year in cohorts}
        for user in users:
            if user["study_year"] in cohorts:
                cohorts[user["study_year"]]["registered"] += 1
        for session in active_sessions:
            year = session["study_year"] if session["study_year"] in cohorts else registration_year(session["registration_number"])
            if year in cohorts:
                cohorts[year]["loggedIn"] += 1
        seen_attempted = {year: set() for year in cohorts}
        latest_attempt_users = {year: set() for year in cohorts}
        leaderboard = []
        for row in attempts:
            year = row["study_year"] if row["study_year"] in cohorts else None
            answers = json.loads(row["answers_json"] or "{}")
            answered = sum(bool(str(value).strip()) for value in answers.values())
            submitted = row["submitted_at"] is not None
            if year:
                seen_attempted[year].add(row["user_id"])
                group = cohorts[year]
                if submitted:
                    cohort_users[year]["completed"].add(row["user_id"])
                else:
                    cohort_users[year]["inProgress"].add(row["user_id"])
                if row["user_id"] not in latest_attempt_users[year] and 1 <= answered <= 4:
                    cohort_users[year]["questions"][answered].add(row["user_id"])
                latest_attempt_users[year].add(row["user_id"])
            grades = json.loads(row["grades_json"] or "{}") if submitted else {}
            if submitted:
                correct = sum(bool(value) for value in grades.values())
            else:
                questions = {q["id"] for task in json.loads(row["questions_json"]) for q in task["questions"]}
                correct = sum(answer_is_correct(qid, str(answers.get(qid, ""))) for qid in questions if str(answers.get(qid, "")).strip())
            unit = 10 if level == 2 else 5
            leaderboard.append({"name": row["full_name"] or row["registration_number"], "registrationNumber": row["registration_number"], "year": year, "answered": answered, "correct": correct, "score": correct * unit, "maxScore": 30 if level == 2 else 20, "seconds": max(0, (row["submitted_at"] or int(time.time())) - row["started_at"]), "status": "Completed" if submitted else "In progress", "submittedAt": row["submitted_at"]})
        for year, group in cohorts.items():
            group["attempted"] = len(seen_attempted[year])
            group["completed"] = len(cohort_users[year]["completed"])
            group["inProgress"] = len(cohort_users[year]["inProgress"] - cohort_users[year]["completed"])
            group["questionCounts"] = {str(n): len(cohort_users[year]["questions"][n]) for n in range(1, 5)}
        leaderboard.sort(key=lambda item: (-item["score"], -item["answered"], item["seconds"]))
        return self.json({"level": level, "cohorts": cohorts, "leaderboard": leaderboard[:100], "updatedAt": int(time.time())})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/admin/login":
            data = self.body_json()
            username, password = str(data.get("username", "")).strip(), str(data.get("password", ""))
            db = connect()
            row = db.execute("SELECT * FROM admins WHERE username=?", (username,)).fetchone()
            if not row or not hmac.compare_digest(password_digest(password, row["password_salt"]), row["password_hash"]):
                db.close()
                return self.json({"error": "Administrator username or password is incorrect."}, 401)
            token = secrets.token_urlsafe(32)
            db.execute("INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES(?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), row["id"], int(time.time()) + 60 * 60 * 8))
            db.commit()
            db.close()
            return self.json({"ok": True}, headers=(("Set-Cookie", f"mits_l1_admin={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800"),))
        if path == "/api/admin/logout":
            cookie = next((part.strip()[14:] for part in self.headers.get("Cookie", "").split(";") if part.strip().startswith("mits_l1_admin=")), None)
            if cookie:
                db = connect()
                db.execute("DELETE FROM admin_sessions WHERE token_hash=?", (hashlib.sha256(cookie.encode()).hexdigest(),))
                db.commit()
                db.close()
            return self.json({"ok": True}, headers=(("Set-Cookie", "mits_l1_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"),))
        if path == "/api/login":
            data = self.body_json()
            regno = normalize_regno(str(data.get("registrationNumber", "")))
            password = str(data.get("password", ""))
            full_name = str(data.get("fullName", "")).strip()[:100]
            try:
                study_year = int(data.get("studyYear", 0))
            except (ValueError, TypeError):
                study_year = 0
            if study_year not in (1, 23):
                return self.json({"error": "Choose your year of study."}, 400)
            if not regno or not password or len(password) > 1024 or not full_name:
                return self.json({"error": "Enter your name, registration number, and password."}, 400)
            db = connect()
            row = db.execute("SELECT * FROM users WHERE registration_number=?", (regno,)).fetchone()
            if not row or not hmac.compare_digest(password_digest(password, row["password_salt"]), row["password_hash"]):
                db.close()
                return self.json({"error": "Registration number or password is incorrect."}, 401)
            token = secrets.token_urlsafe(32)
            prefix_year = registration_year(regno)
            if prefix_year is not None:
                if (prefix_year == 1 and study_year != 1) or (prefix_year in (2, 3) and study_year != 23):
                    db.close()
                    return self.json({"error": "Choose the year group that matches your registration number."}, 403)
                if row["study_year"] and row["study_year"] != prefix_year:
                    db.close()
                    return self.json({"error": "This account is registered for a different year."}, 403)
                actual_year = prefix_year
            else:
                if row["study_year"] and ((row["study_year"] == 1) != (study_year == 1)):
                    db.close()
                    return self.json({"error": "This account is registered for a different year group."}, 403)
                actual_year = row["study_year"] or (1 if study_year == 1 else 23)
            if row["study_year"] and ((row["study_year"] == 1) != (actual_year == 1)):
                db.close()
                return self.json({"error": "This account is registered for a different year of study."}, 403)
            db.execute("UPDATE users SET full_name=?, study_year=? WHERE id=?", (full_name, actual_year, row["id"]))
            now = int(time.time())
            db.execute("INSERT INTO sessions(token_hash,user_id,study_year,expires_at,last_seen) VALUES(?,?,?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), row["id"], actual_year, now + 60 * 60 * 24 * 7, now))
            db.commit()
            db.close()
            return self.json({"ok": True, "registrationNumber": row["registration_number"], "fullName": full_name, "studyYear": actual_year}, headers=(("Set-Cookie", f"mits_l1_sid={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800"),))
        if path == "/api/start-attempt":
            user = self.current_user()
            if not user:
                return self.json({"error": "Sign in first."}, 401)
            data = self.body_json()
            try:
                level = int(data.get("level", 1))
            except (ValueError, TypeError):
                level = 0
            if level not in LEVEL_SECONDS:
                return self.json({"error": "Choose a valid level."}, 400)
            db = connect()
            active = db.execute("SELECT * FROM attempts WHERE user_id=? AND study_year=? AND level=? AND submitted_at IS NULL ORDER BY started_at DESC LIMIT 1", (user["id"], user["study_year"], level)).fetchone()
            now = int(time.time())
            if active and now < active["expires_at"]:
                attempt = active
            else:
                year = user["study_year"]
                questions = []
                source_tasks = LEVEL2_TASKS if level == 2 else TASKS
                for task in source_tasks:
                    task_questions = task["questions"] if level == 2 or year == 1 else [random.choice(task["questions"])]
                    questions.append({"id": task["id"], "title": task["title"], "questions": task_questions})
                attempt_id = secrets.token_urlsafe(18)
                db.execute("INSERT INTO attempts(id,user_id,study_year,level,started_at,expires_at,questions_json) VALUES(?,?,?,?,?,?,?)", (attempt_id, user["id"], year, level, now, now + LEVEL_SECONDS[level], json.dumps(questions)))
                db.commit()
                attempt = db.execute("SELECT * FROM attempts WHERE id=?", (attempt_id,)).fetchone()
            db.close()
            unit = 10 if level == 2 else 5
            maximum = 30 if level == 2 else 20
            return self.json({"id": attempt["id"], "level": level, "expiresAt": attempt["expires_at"], "tasks": json.loads(attempt["questions_json"]), "answers": json.loads(attempt["answers_json"]), "studyYear": user["study_year"], "marksPerAnswer": unit, "maxScore": maximum})
        if path == "/api/save-attempt":
            user = self.current_user()
            if not user:
                return self.json({"error": "Sign in first."}, 401)
            data = self.body_json()
            answers = data.get("answers", {})
            if not isinstance(answers, dict):
                return self.json({"error": "Invalid answers."}, 400)
            db = connect()
            cur = db.execute("UPDATE attempts SET answers_json=? WHERE id=? AND user_id=? AND study_year=? AND submitted_at IS NULL AND expires_at>?", (json.dumps(answers)[:16000], str(data.get("attemptId", "")), user["id"], user["study_year"], int(time.time())))
            db.commit()
            db.close()
            if not cur.rowcount:
                return self.json({"error": "This attempt can no longer be changed."}, 409)
            return self.json({"ok": True})
        if path == "/api/submit-attempt":
            user = self.current_user()
            if not user:
                return self.json({"error": "Sign in first."}, 401)
            data = self.body_json()
            attempt_id = str(data.get("attemptId", ""))
            answers = data.get("answers", {})
            reason = "timer" if data.get("reason") == "timer" else "manual"
            if not isinstance(answers, dict):
                return self.json({"error": "Invalid answers."}, 400)
            db = connect()
            attempt = db.execute("SELECT * FROM attempts WHERE id=? AND user_id=? AND study_year=?", (attempt_id, user["id"], user["study_year"])).fetchone()
            if not attempt:
                db.close()
                return self.json({"error": "Attempt not found."}, 404)
            if attempt["submitted_at"]:
                db.close()
                return self.json({"error": "This attempt was already submitted."}, 409)
            automatic_reasons = {"timer"}
            task_count = len(json.loads(attempt["questions_json"]))
            if reason not in automatic_reasons and (sum(bool(str(answer).strip()) for answer in answers.values()) < task_count):
                db.close()
                return self.json({"error": "Answer the required number of questions before submitting."}, 400)
            if int(time.time()) >= attempt["expires_at"]:
                reason = "timer"
            tasks = json.loads(attempt["questions_json"])
            feedback = []
            grades = {}
            for task in tasks:
                for question in task["questions"]:
                    qid = question["id"]
                    if attempt["level"] == 1 and user["study_year"] == 1 and qid not in answers:
                        continue
                    correct = answer_is_correct(qid, str(answers.get(qid, "")))
                    grades[qid] = correct
                    feedback.append({"task": task["title"], "questionId": qid, "correct": correct, "answer": (LEVEL2_ANSWER_TEXT if attempt["level"] == 2 else ANSWER_TEXT)[qid]})
            submitted_at = int(time.time())
            db.execute("UPDATE attempts SET answers_json=?, grades_json=?, submitted_at=?, submit_reason=? WHERE id=?", (json.dumps(answers)[:16000], json.dumps(grades), submitted_at, reason, attempt_id))
            db.commit()
            db.close()
            marks_per_question = 10 if attempt["level"] == 2 else 5
            return self.json({"ok": True, "results": feedback, "correct": sum(grades.values()), "score": sum(marks_per_question for value in grades.values() if value), "maxScore": 30 if attempt["level"] == 2 else 20, "seconds": max(0, submitted_at - attempt["started_at"])})
        if path == "/api/logout":
            user = self.current_user()
            cookie = next((part.strip()[12:] for part in self.headers.get("Cookie", "").split(";") if part.strip().startswith("mits_l1_sid=")), None)
            if cookie:
                db = connect()
                db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(cookie.encode()).hexdigest(),))
                db.commit()
                db.close()
            return self.json({"ok": True}, headers=(("Set-Cookie", "mits_l1_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"),))
        self.json({"error": "Not found"}, 404)


def add_user(regno: str, password: str, study_year: int | None = None):
    canonical = normalize_regno(regno)
    if not canonical:
        raise SystemExit("Use 26MRA05xxx for first year, 25MRA05xxx for second, or 24MRA05xxx for third year.")
    prefix_year = registration_year(canonical)
    if prefix_year is not None:
        if study_year is not None and study_year != prefix_year:
            raise SystemExit(f"{canonical} belongs to year {prefix_year}.")
        study_year = prefix_year
    if len(password) < 8:
        raise SystemExit("Use a password with at least 8 characters.")
    salt = secrets.token_bytes(16)
    db = connect()
    try:
        db.execute("INSERT INTO users(registration_number,password_salt,password_hash,created_at,study_year) VALUES(?,?,?,?,?)", (canonical, salt, password_digest(password, salt), int(time.time()), study_year))
        db.commit()
    except sqlite3.IntegrityError:
        raise SystemExit(f"{canonical} is already registered.")
    finally:
        db.close()
    print(f"Added {canonical}.")


def list_users():
    db = connect()
    rows = db.execute("SELECT registration_number, full_name, study_year, datetime(created_at, 'unixepoch', 'localtime') AS added FROM users ORDER BY study_year, registration_number").fetchall()
    db.close()
    if not rows:
        print("No registered users yet.")
    for row in rows:
        year = f"Year {row['study_year']}" if row["study_year"] else "Choose year at sign in"
        print(f"{row['registration_number']}  · {row['full_name'] or 'Name entered at sign in'}  · {year}  (added {row['added']})")


def set_user_year(regno: str, study_year: int):
    canonical = normalize_regno(regno)
    if not canonical:
        raise SystemExit("Enter a valid registration number.")
    prefix_year = registration_year(canonical)
    if prefix_year is not None and prefix_year != study_year:
        raise SystemExit(f"{canonical} belongs to year {prefix_year}.")
    db = connect()
    cur = db.execute("UPDATE users SET study_year=? WHERE registration_number=?", (study_year, canonical))
    db.commit()
    db.close()
    if not cur.rowcount:
        raise SystemExit(f"No account found for {canonical}.")
    print(f"Set {canonical} to Year {study_year}.")


def list_attempts(study_year: int | None = None):
    db = connect()
    if study_year == 1:
        rows = db.execute("SELECT a.*, u.registration_number, u.full_name FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.submitted_at IS NOT NULL AND a.study_year=? ORDER BY a.submitted_at DESC", (study_year,)).fetchall()
    elif study_year in (2, 3):
        rows = db.execute("SELECT a.*, u.registration_number, u.full_name FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.submitted_at IS NOT NULL AND a.study_year IN (2,3,23) ORDER BY a.submitted_at DESC").fetchall()
    else:
        rows = db.execute("SELECT a.*, u.registration_number, u.full_name FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC").fetchall()
    db.close()
    if not rows:
        print("No submitted attempts yet.")
        return
    for row in rows:
        print(f"\nAttempt {row['id']} · Level {row['level']} · {row['full_name'] or row['registration_number']} · {row['registration_number']} · Group {row['study_year']} · {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(row['submitted_at']))} · {row['submit_reason']}")
        tasks = json.loads(row["questions_json"])
        answers = json.loads(row["answers_json"])
        for task in tasks:
            for question in task["questions"]:
                answer = answers.get(question["id"], "(not answered)")
                print(f"  {task['title']} · {question['id']}: {question['prompt']}")
                print("  " + str(answer).replace("\n", "\n  "))


def mark_attempt(attempt_id: str, correct_ids: str):
    db = connect()
    row = db.execute("SELECT questions_json, answers_json FROM attempts WHERE id=? AND submitted_at IS NOT NULL", (attempt_id,)).fetchone()
    if not row:
        db.close()
        raise SystemExit("No submitted attempt found with that ID.")
    questions = [question for task in json.loads(row["questions_json"]) for question in task["questions"]]
    answers = json.loads(row["answers_json"])
    attempted_ids = {question["id"] for question in questions if str(answers.get(question["id"], "")).strip()}
    correct = {item.strip() for item in correct_ids.split(",") if item.strip()}
    if not correct.issubset(attempted_ids):
        db.close()
        raise SystemExit("Only answered question IDs from this attempt can be marked correct.")
    grades = {question_id: question_id in correct for question_id in attempted_ids}
    db.execute("UPDATE attempts SET grades_json=? WHERE id=?", (json.dumps(grades), attempt_id))
    db.commit()
    db.close()
    print(f"Marked {len(correct)} answer(s) correct ({len(correct) * 5}/20 marks).")


def main():
    parser = argparse.ArgumentParser(description="Run the MIT login page or manage registered students.")
    sub = parser.add_subparsers(dest="command")
    serve = sub.add_parser("serve", help="Start the local web server")
    serve.add_argument("--port", type=int, default=8008)
    serve.add_argument("--host", default="192.168.1.6", help="Network interface to serve on")
    add = sub.add_parser("add-user", help="Add a registered student")
    add.add_argument("registration_number")
    add.add_argument("--password", help="Password (prompted securely if omitted)")
    add.add_argument("--year", type=int, choices=(1, 2, 3), help="Assign the student to year 1, 2, or 3")
    set_year = sub.add_parser("set-year", help="Assign a registered student to a year")
    set_year.add_argument("registration_number")
    set_year.add_argument("year", type=int, choices=(1, 2, 3))
    sub.add_parser("list-users", help="List registered student numbers")
    attempts = sub.add_parser("list-attempts", help="Read submitted student answers")
    attempts.add_argument("--year", type=int, choices=(1, 2, 3), help="Filter by study year")
    mark = sub.add_parser("mark-attempt", help="Mark correct answers for the leaderboard")
    mark.add_argument("attempt_id")
    mark.add_argument("--correct", default="", help="Comma-separated question IDs, such as c-1,dsa-2,python-3,dbms-4")
    args = parser.parse_args()
    if args.command == "add-user":
        import getpass
        add_user(args.registration_number, args.password or getpass.getpass("New password (8+ characters): "), args.year)
    elif args.command == "set-year":
        set_user_year(args.registration_number, args.year)
    elif args.command == "list-attempts":
        list_attempts(args.year)
    elif args.command == "mark-attempt":
        mark_attempt(args.attempt_id, args.correct)
    elif args.command == "list-users":
        list_users()
    else:
        connect().close()
        server = ThreadingHTTPServer((args.host, args.port), Handler)
        print(f"Login page is available at http://{args.host}:{args.port} (Ctrl+C to stop)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
        finally:
            server.server_close()


if __name__ == "__main__":
    main()
