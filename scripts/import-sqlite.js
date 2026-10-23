"use strict";

require("dotenv").config();

const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { MongoClient } = require("mongodb");

const sqlitePath = path.join(__dirname, "..", "data", "users.sqlite3");
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mits_login";
const databaseName = process.env.MONGODB_DB || "mits_login";

function parseJson(value, fallback) {
  try { return JSON.parse(value || ""); } catch { return fallback; }
}

async function main() {
  const legacy = new DatabaseSync(sqlitePath, { readOnly: true });
  const legacyUsers = legacy.prepare("SELECT id, registration_number, full_name, password_salt, password_hash, created_at, study_year FROM users").all();
  const legacyAdmins = legacy.prepare("SELECT id, username, password_salt, password_hash, created_at FROM admins").all();
  const legacyAttempts = legacy.prepare("SELECT id, user_id, study_year, level, started_at, expires_at, questions_json, answers_json, grades_json, submitted_at, submit_reason FROM attempts").all();
  legacy.close();

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(databaseName);
  await Promise.all([
    db.collection("users").createIndex({ registrationNumber: 1 }, { unique: true }),
    db.collection("admins").createIndex({ username: 1 }, { unique: true }),
    db.collection("attempts").createIndex({ attemptId: 1 }, { unique: true }),
  ]);

  const userIds = new Map();
  for (const row of legacyUsers) {
    const registrationNumber = String(row.registration_number);
    await db.collection("users").updateOne({ registrationNumber }, {
      $setOnInsert: {
        registrationNumber,
        fullName: row.full_name || null,
        passwordSalt: Buffer.from(row.password_salt).toString("base64"),
        passwordHash: Buffer.from(row.password_hash).toString("base64"),
        createdAt: Number(row.created_at),
        studyYear: row.study_year == null ? null : Number(row.study_year),
        legacyId: Number(row.id),
      },
    }, { upsert: true });
    const imported = await db.collection("users").findOne({ registrationNumber }, { projection: { _id: 1 } });
    userIds.set(Number(row.id), imported._id);
  }

  for (const row of legacyAdmins) {
    const username = String(row.username);
    await db.collection("admins").updateOne({ username }, {
      $setOnInsert: {
        username,
        passwordSalt: Buffer.from(row.password_salt).toString("base64"),
        passwordHash: Buffer.from(row.password_hash).toString("base64"),
        createdAt: Number(row.created_at),
        legacyId: Number(row.id),
      },
    }, { upsert: true });
  }

  for (const row of legacyAttempts) {
    const userId = userIds.get(Number(row.user_id));
    if (!userId) continue;
    const attemptId = String(row.id);
    await db.collection("attempts").updateOne({ attemptId }, {
      $setOnInsert: {
        attemptId,
        userId,
        studyYear: Number(row.study_year),
        level: Number(row.level || 1),
        startedAt: Number(row.started_at),
        expiresAt: Number(row.expires_at),
        questions: parseJson(row.questions_json, []),
        answers: parseJson(row.answers_json, {}),
        grades: parseJson(row.grades_json, {}),
        submittedAt: row.submitted_at == null ? null : Number(row.submitted_at),
        submitReason: row.submit_reason || null,
      },
    }, { upsert: true });
  }

  console.log(`Imported or preserved ${legacyUsers.length} student accounts, ${legacyAdmins.length} admin account(s), and ${legacyAttempts.length} attempts.`);
  console.log("Existing sessions were not migrated; users must sign in again.");
  await client.close();
}

main().catch((error) => {
  console.error("SQLite to MongoDB import failed:", error.message);
  process.exitCode = 1;
});
