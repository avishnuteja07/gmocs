"use strict";

require("dotenv").config();

const crypto = require("node:crypto");
const { promisify } = require("node:util");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { MongoClient } = require("mongodb");
const content = require("./content.json");

const pbkdf2 = promisify(crypto.pbkdf2);
const iterations = 310_000;
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "mits_login";

function normalizeRegistrationNumber(value) {
  const registrationNumber = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(registrationNumber) ? registrationNumber : null;
}

function normalizeStudyYear(value) {
  const text = String(value || "").trim().toUpperCase();
  return ({ I: 1, II: 2, III: 3 })[text] || Number(text);
}

function normalizeAnswer(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function answerIsCorrect(questionId, answer) {
  const normalized = normalizeAnswer(answer);
  const level2Patterns = content.level2Patterns[questionId];
  if (level2Patterns) return level2Patterns.every((pattern) => new RegExp(pattern).test(normalized));
  const patterns = content.answerPatterns[questionId] || [];
  if (["c-1", "dbms-1", "dbms-2"].includes(questionId)) return patterns.some((pattern) => new RegExp(pattern).test(normalized));
  if (questionId === "c-5") {
    const changesValue = ["\\*x\\+\\+", "\\+\\+\\(\\*x\\)", "\\*x\\+=1", "\\*x=\\*x\\+1"].some((pattern) => new RegExp(pattern).test(normalized));
    return patterns.every((pattern) => new RegExp(pattern).test(normalized)) && changesValue;
  }
  if (questionId === "dsa-3") return patterns.every((pattern) => new RegExp(pattern).test(normalized));
  if (questionId === "dsa-5") {
    const positions = ["next=cur->next", "cur->next=prev", "cur=next"].map((pattern) => normalized.indexOf(pattern));
    return Math.min(...positions) >= 0 && positions.every((position, index) => index === 0 || positions[index - 1] <= position);
  }
  if (questionId === "python-4") return /globalx/.test(normalized);
  return patterns.some((pattern) => new RegExp(pattern).test(normalized));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!uri) throw new Error("MONGODB_URI is required. Set it in your private .env file or deployment environment.");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(databaseName);
  try {
    if (command === "add-admin") {
      const username = String(args[0] || "").trim();
      if (!username || username.length > 80) throw new Error("Usage: node manage.js add-admin USERNAME");
      const prompt = readline.createInterface({ input, output });
      const password = await prompt.question("Admin password (minimum 8 characters): ");
      prompt.close();
      if (password.length < 8 || password.length > 1024) throw new Error("Use an admin password between 8 and 1024 characters.");
      const salt = crypto.randomBytes(16);
      const hash = await pbkdf2(password, salt, iterations, 32, "sha256");
      await db.collection("admins").insertOne({
        username,
        passwordSalt: salt.toString("base64"),
        passwordHash: hash.toString("base64"),
        createdAt: Math.floor(Date.now() / 1000),
      });
      console.log(`Added administrator ${username}.`);
    } else if (command === "add-user") {
      const registrationNumber = normalizeRegistrationNumber(args[0]);
      const yearArg = args.indexOf("--year");
      const studyYear = yearArg >= 0 ? normalizeStudyYear(args[yearArg + 1]) : null;
      if (!registrationNumber) throw new Error("Use a registration number with exactly 10 letters or digits.");
      if (![1, 2, 3].includes(studyYear)) throw new Error("Provide --year I, II, or III.");
      const fullName = registrationNumber;
      const password = "tech@123";
      const salt = crypto.randomBytes(16);
      const hash = await pbkdf2(password, salt, iterations, 32, "sha256");
      await db.collection("users").insertOne({
        registrationNumber,
        fullName,
        studyYear,
        passwordSalt: salt.toString("base64"),
        passwordHash: hash.toString("base64"),
        createdAt: Math.floor(Date.now() / 1000),
      });
      console.log(`Added ${registrationNumber} for year ${studyYear} with the default student password.`);
    } else if (command === "set-year") {
      const registrationNumber = normalizeRegistrationNumber(args[0]);
      const year = normalizeStudyYear(args[1]);
      if (!registrationNumber || ![1, 2, 3].includes(year)) throw new Error("Usage: node manage.js set-year REGISTRATION_NUMBER YEAR");
      const result = await db.collection("users").updateOne({ registrationNumber }, { $set: { studyYear: year } });
      if (!result.matchedCount) throw new Error("No account found for that registration number.");
      console.log(`Set ${registrationNumber} to year ${year}.`);
    } else if (command === "list-users") {
      const users = await db.collection("users").find({}, { projection: { registrationNumber: 1, fullName: 1, studyYear: 1 } }).sort({ studyYear: 1, registrationNumber: 1 }).toArray();
      if (!users.length) console.log("No registered students yet.");
      for (const user of users) console.log(`${user.registrationNumber} · ${user.fullName || "Name entered at sign in"} · Year ${user.studyYear || "not assigned"}`);
    } else if (command === "list-attempts") {
      const yearArg = args.indexOf("--year");
      const year = yearArg >= 0 ? Number(args[yearArg + 1]) : null;
      const filter = year ? { studyYear: year } : {};
      const attempts = await db.collection("attempts").aggregate([
        { $match: filter },
        { $sort: { startedAt: -1 } },
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      ]).toArray();
      if (!attempts.length) console.log("No attempts found.");
      for (const attempt of attempts) {
        console.log(`\nAttempt ${attempt.attemptId} · Level ${attempt.level} · ${attempt.user?.fullName || attempt.user?.registrationNumber || "Unknown student"} · ${attempt.user?.registrationNumber || ""} · Year ${attempt.studyYear} · ${attempt.submittedAt ? new Date(attempt.submittedAt * 1000).toLocaleString() : "In progress"}`);
        for (const task of attempt.questions) for (const question of task.questions) console.log(`  ${task.title} · ${question.id}: ${attempt.answers?.[question.id] || "(not answered)"}`);
      }
    } else if (command === "mark-attempt") {
      const attemptId = args[0];
      const correctArg = args.indexOf("--correct");
      if (!attemptId || correctArg < 0) throw new Error("Usage: node manage.js mark-attempt ATTEMPT_ID --correct q1,q2");
      const attempt = await db.collection("attempts").findOne({ attemptId, submittedAt: { $ne: null } });
      if (!attempt) throw new Error("No submitted attempt found with that ID.");
      const requested = new Set(String(args[correctArg + 1] || "").split(",").map((item) => item.trim()).filter(Boolean));
      const answered = new Set(attempt.questions.flatMap((task) => task.questions.map((question) => question.id)).filter((id) => String(attempt.answers?.[id] || "").trim()));
      if ([...requested].some((id) => !answered.has(id))) throw new Error("Only answered question IDs from this attempt can be marked correct.");
      const grades = Object.fromEntries([...answered].map((id) => [id, requested.has(id)]));
      await db.collection("attempts").updateOne({ attemptId }, { $set: { grades } });
      console.log(`Marked ${requested.size} answer(s) correct.`);
    } else {
      console.log("Commands: add-admin, add-user, set-year, list-users, list-attempts, mark-attempt");
      console.log("Examples: node manage.js add-admin admin-name");
      console.log("Examples: node manage.js add-user A1B2C3D4E5 --year I");
      console.log("          node manage.js list-attempts --year 1");
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
