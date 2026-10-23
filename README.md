# MITS Student Login and Coding Challenge

Express serves the student login, timed exams, leaderboard, and administrator dashboard. MongoDB Atlas stores student accounts, admin accounts, sessions, attempts, answers, and scores. This deployment package includes no student, admin, attempt, or session records.

## Requirements

- Node.js 22.13 or newer
- A MongoDB Atlas cluster and database user

## Configure Atlas

1. In Atlas, allow network access from the deployment host and create a database user with access to the application database.
2. Copy `.env.example` to `.env` for local use. Set `MONGODB_URI` to the private Atlas connection string, including the database name and Atlas query options. Set `MONGODB_DB` to the database name.
3. Never commit `.env` or add it to a ZIP. For hosted deployment, set the same variables in the provider's environment-variable settings instead.
4. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, `HOST=0.0.0.0`, and the provider's assigned `PORT` for a public HTTPS deployment. Locally, use `HOST=127.0.0.1` and `COOKIE_SECURE=false`.
5. Set private values for `LEVEL_2_PIN` and `LEVEL_3_PIN`. The server verifies them whenever a student starts or resumes the corresponding level. Level 1 does not require a PIN. A PIN-protected level cannot be started until its PIN is configured. Never put real PINs in `.env.example` or share them in the ZIP; restart the server after changing them.

## Run locally

```powershell
npm install
npm start
```

Open `http://127.0.0.1:3000/`. The app uses port 3000 by default; set `PORT` only when your hosting provider requires a different assigned port. The app fails at startup if `MONGODB_URI` is missing or Atlas cannot be reached. It does not create default student users; the environment-managed administrator is created only when both admin variables are configured.

## Create accounts

Configure the administrator in the private `.env` or deployment secrets with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. On startup, the app creates or updates the environment-managed admin from those values, so changing either value and restarting applies the change. The password must be at least 8 characters. Leave both unset for no admin records. Alternatively, create an admin once from a trusted machine:

```powershell
node manage.js add-admin ADMIN_USERNAME
```

Then add student registrations individually:

```powershell
node manage.js add-user A1B2C3D4E5 --year I
```

Student passwords are stored as salted PBKDF2 hashes. Registrations accept exactly 10 letters or digits and are stored in uppercase; the study year is selected separately. The CLI and imported students use the default password `tech@123`. There are no preloaded registrations; only accounts added to the configured MongoDB database can sign in.

Administrators can also use the **Students** tab to add, edit, and delete accounts. Student login uses registration number, year (I, II, or III), and password. New accounts use `tech@123` by default. The Excel import template contains only `Registration Number` and `Year`; every imported student receives the default password. Imports accept up to 500 rows per workbook and report skipped rows. The roster export contains registration number and year only.

Useful account and review commands:

```powershell
node manage.js list-users
node manage.js list-attempts --year 1
node manage.js mark-attempt ATTEMPT_ID --correct c-1,dsa-2
```

## Exams

- Level 1, Bug Smash, lasts 15 minutes. First-year students choose one question from each task. Second- and third-year students receive one shuffled question from each task.
- Students start with Level 1. Completing each level locks it and unlocks the next level; completing Level 3 locks all levels. Students see completion status, while live leaderboards remain in the administrator view only.
- Level 2, Code Rescue, lasts 25 minutes and has three practical 10-mark tasks: CSS Profile Card, Smart Traffic Signal, and Daily Water Tracker (5 tests per question, 2 marks per test, 30 marks total), complete with interactive live preview boxes and instant in-browser test feedback.
- Level 3 unlocks after Level 2. It lasts 30 minutes and assigns two different questions from an eight-question pool. There are 28 possible unique pairs; assignments are allocated without repeating a pair until the pool cycles, then shuffled in question order. Each question has two visible examples and three hidden tests; each passed test is worth 5 marks, up to 50 marks.
- Level 3 supports C, C++, C#, Java, JavaScript, and Python with a high-performance multi-tier execution engine and multiple fallbacks (`RUNNER_PREFERENCE=local,remote`). The local native engine detects installed tools (Python, Node.js, GCC, G++, CSC, OpenJDK Java) and compiles/executes code locally in milliseconds without network queues or external rate limits. All six languages (Python, JavaScript, C, C++, Java, and C#) provide LeetCode-style function starters for all eight problems: students simply implement the named function or solution method, and the server automatically handles input parsing, argument passing, and output formatting. Full standalone programs with custom input/output are also supported. If the local runner is unavailable or fails, execution seamlessly falls back to primary and secondary Judge0 services (`JUDGE0_URL`, `JUDGE0_FALLBACK_URLS`). The coding workspace separates the statement from the editor. Exact-output grading ignores trailing spaces at line ends while preserving leading spaces. Failed public cases show the actual output or compiler/runtime error. Repeating verification with unchanged source reuses the saved result; verifier versioning ensures older cached results are recalculated after grader fixes. Debug runs do not affect marks. Set `LEVEL_3_PIN`, and configure `RUNNER_PREFERENCE`, `JUDGE0_URL`, optional `JUDGE0_AUTH_TOKEN`, and `JUDGE0_LANGUAGE_IDS` in the private `.env`.
- Exam questions and grading patterns live in `content.json`; this is challenge content, not student registration data.

## Deployment notes (Render, Railway, Fly.io, Cloud)

The application includes a production-ready `Dockerfile`, `render.yaml`, and `railway.json`.

### Deploying on Render (Recommended: Docker Service)
1. In the **Render Dashboard**, choose **New +** $\rightarrow$ **Web Service**.
2. Connect your Git repository.
3. Select **Docker** as the Environment (Render auto-detects `Dockerfile`).
4. Set the following Environment Variables under **Environment**:
   - `MONGODB_URI`: your MongoDB Atlas connection string
   - `MONGODB_DB`: `mits_login`
   - `NODE_ENV`: `production`
   - `RUNNER_PREFERENCE`: `local,remote`
   - `ADMIN_PASSWORD`: your secret admin password
   - `LEVEL_2_PIN`: your Level 2 unlock PIN
   - `LEVEL_3_PIN`: your Level 3 unlock PIN
5. Render automatically builds the container with **all 6 compilers** (Node, Python, GCC, G++, Java 17, Mono C#), giving students sub-second code compilation with zero external API fees.

### Deploying on Railway
1. In the **Railway Dashboard**, create a **New Project** $\rightarrow$ **Deploy from GitHub repo**.
2. Railway detects the `railway.json` and `Dockerfile` automatically.
3. Add the same Environment Variables (`MONGODB_URI`, `ADMIN_PASSWORD`, `LEVEL_2_PIN`, `LEVEL_3_PIN`, etc.) in the **Variables** tab.
4. Railway deploys and generates a public HTTPS URL. Health checks run against `/health` or `/`.

### Fallback Remote Code Execution
If deployed in a minimal runtime without compilers, Level 3 automatically switches to remote execution:
- Set `JUDGE0_URL` (e.g. your own Judge0 on Railway or public endpoint)
- Optional: `JUDGE0_AUTH_TOKEN` (for private self-hosted Judge0) or `RAPIDAPI_KEY` (if using RapidAPI Judge0)
- Optional: `JUDGE0_FALLBACK_URLS` (comma-separated mirror endpoints)

## Main files

- `server.js` — Express API, authentication, scoring, and MongoDB persistence
- `level3Runner.js` — High-performance multi-tier Level 3 execution engine with fast local native compilers and Judge0 fallbacks
- `manage.js` — explicit student/admin provisioning and attempt management
- `content.json` — question content and answer checking rules
- `static/` — login, exam, and administrator interface plus supplied campus/logo assets
"# tech-tussle" 
"# tech-tussle" 
"# gmocs" 
"# gmocs" 
