"use strict";

require("dotenv").config();

const crypto = require("node:crypto");
const path = require("node:path");
const vm = require("node:vm");
const { promisify } = require("node:util");
const express = require("express");
const { MongoClient } = require("mongodb");
const XLSX = require("xlsx");
const content = require("./content.json");
const {
  executeLevel3Tests,
  executeLevel3Debug,
  judgeLanguageIds,
  level3OutputPasses,
  buildLevel3FunctionProgram,
  getLocalSupportedLanguages,
  LOCAL_TOOLS,
} = require("./level3Runner");

const pbkdf2 = promisify(crypto.pbkdf2);
const ROOT = __dirname;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "mits_login";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ITERATIONS = 310_000;
const LEVEL_SECONDS = { 1: 900, 2: 1500, 3: 1800 };
const LEVEL3_VERIFIER_VERSION = 5;
const DEFAULT_JUDGE0_LANGUAGE_IDS = { c: 50, cpp: 54, csharp: 51, java: 62, javascript: 63, python: 71 };

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Create a .env file next to server.js using .env.example, then add your MongoDB Atlas connection string.");
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
let db;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(ROOT, "static"), { index: "index.html", fallthrough: true }));

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  const part = (req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}

function sessionCookie(res, name, token, maxAgeSeconds) {
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookies(),
    path: "/",
    maxAge: maxAgeSeconds * 1000,
  });
}

function clearCookie(res, name) {
  res.clearCookie(name, { httpOnly: true, sameSite: "strict", secure: secureCookies(), path: "/" });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeRegistrationNumber(value) {
  const registrationNumber = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(registrationNumber) ? registrationNumber : null;
}

function safeCompareBase64(candidate, expectedBase64) {
  const expected = Buffer.from(expectedBase64 || "", "base64");
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

async function passwordMatches(password, saltBase64, hashBase64) {
  const salt = Buffer.from(saltBase64 || "", "base64");
  if (!salt.length || !hashBase64) return false;
  const candidate = await pbkdf2(password, salt, ITERATIONS, 32, "sha256");
  return safeCompareBase64(candidate, hashBase64);
}

async function makePasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = await pbkdf2(password, salt, ITERATIONS, 32, "sha256");
  return { passwordSalt: salt.toString("base64"), passwordHash: hash.toString("base64") };
}

function secureCookies() {
  return process.env.COOKIE_SECURE === "true" || (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");
}

async function currentUser(req) {
  const token = cookieValue(req, "mits_l1_sid");
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await db.collection("sessions").findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  if (!session) return null;
  await db.collection("sessions").updateOne({ _id: session._id }, { $set: { lastSeen: new Date() } });
  const user = await db.collection("users").findOne({ _id: session.userId });
  return user ? { ...user, sessionStudyYear: session.studyYear } : null;
}

async function currentAdmin(req) {
  const token = cookieValue(req, "mits_l1_admin");
  if (!token) return null;
  const envAdmin = String(process.env.ADMIN_USERNAME || "").trim();
  if (!envAdmin) return null;
  const session = await db.collection("admin_sessions").findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  return { username: envAdmin };
}

function normalizeAnswer(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function answerSource(value) {
  return typeof value === "string" ? value : String(value?.source || "");
}

function answerLanguage(value) {
  return typeof value === "string" ? "" : String(value?.language || "");
}

function answerFingerprint(language, source, mode = "program") {
  return crypto.createHash("sha256").update(`${language}\0${mode}\0${source}`).digest("hex");
}

function answerMode(value) {
  return value && typeof value === "object" && value.mode === "function" ? "function" : "program";
}

const LEVEL2_CASE_PATTERN_GROUPS = {
  "css-1": [[0, 1, 2, 3], [4, 5, 6], [7, 8], [9, 10, 11], [12, 13, 14, 15, 16]],
  "banner-1": [[0, 1, 2, 3, 4], [5, 6], [7, 8, 9, 10, 11], [12, 13], [14, 15, 16, 17, 18]],
  "bulb-1": [[0], [1], [2], [3], [4]],
  "canteen-1": [[0], [1], [2], [3], [4]],
  "event-1": [[0], [1], [2], [3], [4]],
  "traffic-1": [[1, 2, 3], [0, 4, 7], [0, 5, 7], [0, 6, 7], [0, 7, 8]],
  "water-1": [[2], [0, 3, 5], [0, 3, 6], [1, 4, 5], [0, 1, 3, 4]],
  "express-1": [[0, 14], [1, 2, 15], [3, 4, 5, 16], [6, 11, 12, 13], [7, 8, 9, 10, 17, 18]],
  "react-1": [[0, 1, 11], [2, 4, 7], [2, 4, 6, 7], [3, 4, 5, 7], [3, 8, 9, 7]],
};

function evaluateBulbCode(html) {
  const checkStatic = (code) => {
    const norm = String(code || "").toLowerCase().replace(/\s+/g, "");
    const has = (p) => new RegExp(p, "i").test(norm);
    const tc1 = has('id=["\']?bulb') && has('id=["\']?status');

    const onMatch = String(code || "").match(/function\s+turnOn\s*\([^)]*\)\s*\{([\s\S]*?)\}/i);
    const onBody = onMatch ? onMatch[1].replace(/\/\/[^\n]*/g, "").trim() : "";
    const onNorm = onBody.toLowerCase().replace(/\s+/g, "");
    const onHas = (p) => new RegExp(p, "i").test(onNorm);

    const offMatch = String(code || "").match(/function\s+turnOff\s*\([^)]*\)\s*\{([\s\S]*?)\}/i);
    const offBody = offMatch ? offMatch[1].replace(/\/\/[^\n]*/g, "").trim() : "";
    const offNorm = offBody.toLowerCase().replace(/\s+/g, "");
    const offHas = (p) => new RegExp(p, "i").test(offNorm);

    const hasYellow = onHas("gold") || onHas("yellow") || onHas("#ffd700") || onHas("#eab308") || onHas("#facc15") || onHas("rgb\\(255,215,0\\)") || onHas("rgb\\(255,255,0\\)");
    const hasOnText = onHas("lightison") || onHas("on");
    const tc2 = Boolean(onBody.length > 5 && hasYellow && hasOnText);

    const hasGray = offHas("gray") || offHas("grey") || offHas("#808080") || offHas("#64748b") || offHas("rgb\\(128,128,128\\)");
    const hasOffText = offHas("lightisoff") || offHas("off");
    const tc3 = Boolean(offBody.length > 5 && hasGray && hasOffText);

    return [tc1, tc2, tc3, tc2, tc3];
  };

  const checkVm = (code) => {
    const scriptMatch = String(code || "").match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) return [false, false, false, false, false];
    const js = scriptMatch[1];

    let statusValue = "Light is OFF";
    const elements = {
      bulb: { id: "bulb", style: { backgroundColor: "gray" }, className: "bulb" },
      status: {
        id: "status",
        get innerHTML() { return statusValue; },
        set innerHTML(v) { statusValue = String(v); },
        get textContent() { return statusValue; },
        set textContent(v) { statusValue = String(v); },
        get innerText() { return statusValue; },
        set innerText(v) { statusValue = String(v); },
      }
    };

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelector: (sel) => typeof sel === "string" && sel.startsWith("#") ? elements[sel.slice(1)] || null : null
      },
      console: { log: () => {} }
    };

    try {
      vm.createContext(sandbox);
      vm.runInContext(js, sandbox, { timeout: 1000 });
    } catch {
      return [false, false, false, false, false];
    }

    const isGoldOrYellow = () => {
      const bg = String(elements.bulb.style.backgroundColor || elements.bulb.style.background || "").toLowerCase().replace(/\s+/g, "");
      return bg.includes("gold") || bg.includes("yellow") || bg.includes("#ffd700") || bg.includes("#eab308") || bg.includes("#facc15") || bg.includes("255,215,0") || bg.includes("255,255,0");
    };
    const isGray = () => {
      const bg = String(elements.bulb.style.backgroundColor || elements.bulb.style.background || "").toLowerCase().replace(/\s+/g, "");
      return bg.includes("gray") || bg.includes("grey") || bg.includes("#808080") || bg.includes("#64748b") || bg.includes("128,128,128");
    };
    const getStatus = () => String(elements.status.innerHTML).toLowerCase();

    // TC 1: Initial state (gray, Light is OFF)
    const tc1 = isGray() && getStatus().includes("off");

    if (typeof sandbox.turnOn !== "function" || typeof sandbox.turnOff !== "function") {
      return [tc1, false, false, false, false];
    }

    // TC 2: Click Turn ON -> bulb turns yellow/gold and status shows "Light is ON"
    try { sandbox.turnOn(); } catch {}
    const tc2 = isGoldOrYellow() && getStatus().includes("on") && !getStatus().includes("off");

    // TC 3: Click Turn OFF -> bulb turns gray and status shows "Light is OFF"
    try { sandbox.turnOff(); } catch {}
    const tc3 = tc2 && isGray() && getStatus().includes("off");

    // TC 4: Click Turn ON again -> bulb turns yellow/gold and status shows "Light is ON"
    try { sandbox.turnOn(); } catch {}
    const tc4 = isGoldOrYellow() && getStatus().includes("on") && !getStatus().includes("off");

    // TC 5: Toggle cycle -> Turn OFF returns to gray and "Light is OFF"
    try { sandbox.turnOff(); } catch {}
    const tc5 = tc4 && isGray() && getStatus().includes("off");

    return [tc1, tc2, tc3, tc4, tc5];
  };

  const s = checkStatic(html);
  const v = checkVm(html);
  return s.map((r, i) => r || v[i]);
}

function evaluateCanteenCode(html) {
  const checkStatic = (code) => {
    const norm = String(code || "").toLowerCase().replace(/\s+/g, "");
    const has = (p) => new RegExp(p, "i").test(norm);
    const hasItem = has('id=["\']?item');
    const hasQty = has('id=["\']?qty');
    const hasResult = has('id=["\']?result');
    const tc1 = hasItem && hasQty && hasResult;

    const bodyMatch = String(code || "").match(/function\s+bill\s*\([^)]*\)\s*\{([\s\S]*?)\}/i);
    const body = bodyMatch ? bodyMatch[1].replace(/\/\/[^\n]*/g, "").trim() : "";
    const bodyNorm = body.toLowerCase().replace(/\s+/g, "");
    const bodyHas = (p) => new RegExp(p, "i").test(bodyNorm);

    const hasBillFn = Boolean(body.length > 5);
    const hasMultiply = bodyHas("\\*") || bodyHas("price\\*qty") || bodyHas("total");
    const hasDomOutput = (bodyHas("textcontent") || bodyHas("innerhtml") || bodyHas("innertext")) && bodyHas("result");

    const passesCalc = hasBillFn && (hasMultiply || hasDomOutput);

    return [
      tc1,
      passesCalc,
      passesCalc,
      passesCalc,
      passesCalc
    ];
  };

  const checkVm = (code) => {
    const scriptMatch = String(code || "").match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) return [false, false, false, false, false];
    const js = scriptMatch[1];

    let resultValue = "";
    const elements = {
      item: { id: "item", value: "40" },
      qty: { id: "qty", value: "1" },
      result: {
        id: "result",
        get innerHTML() { return resultValue; },
        set innerHTML(v) { resultValue = String(v); },
        get textContent() { return resultValue; },
        set textContent(v) { resultValue = String(v); },
        get innerText() { return resultValue; },
        set innerText(v) { resultValue = String(v); },
      }
    };

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelector: (sel) => {
          if (typeof sel === "string" && sel.startsWith("#")) return elements[sel.slice(1)] || null;
          return null;
        }
      },
      parseInt,
      parseFloat,
      Number,
      console: { log: () => {} }
    };

    try {
      vm.createContext(sandbox);
      vm.runInContext(js, sandbox, { timeout: 1000 });
    } catch {
      return [false, false, false, false, false];
    }

    const tc1 = Boolean(elements.item && elements.qty && elements.result);
    if (typeof sandbox.bill !== "function") return [tc1, false, false, false, false];

    const getResultText = () => String(elements.result.textContent || elements.result.innerHTML || elements.result.innerText || "");

    // TC 2: Sandwich (40) * 1 = 40
    elements.item.value = "40";
    elements.qty.value = "1";
    try { sandbox.bill(); } catch {}
    const tc2 = getResultText().includes("40");

    // TC 3: Sandwich (40) * 2 = 80
    elements.item.value = "40";
    elements.qty.value = "2";
    try { sandbox.bill(); } catch {}
    const tc3 = getResultText().includes("80");

    // TC 4: Juice (25) * 3 = 75
    elements.item.value = "25";
    elements.qty.value = "3";
    try { sandbox.bill(); } catch {}
    const tc4 = getResultText().includes("75");

    // TC 5: Samosa (15) * 4 = 60
    elements.item.value = "15";
    elements.qty.value = "4";
    try { sandbox.bill(); } catch {}
    const tc5 = getResultText().includes("60");

    return [tc1, tc2, tc3, tc4, tc5];
  };

  const s = checkStatic(html);
  const v = checkVm(html);
  return s.map((r, i) => r || v[i]);
}

function evaluateEventCode(html) {
  const checkStatic = (code) => {
    const norm = String(code || "").toLowerCase().replace(/\s+/g, "");
    const has = (p) => new RegExp(p, "i").test(norm);
    const tc1 = has('id=["\']?count') && (has('>0<') || has('textContent=["\']?0'));

    const regMatch = String(code || "").match(/function\s+register\s*\([^)]*\)\s*\{([\s\S]*?)\}/i);
    const regBody = regMatch ? regMatch[1].replace(/\/\/[^\n]*/g, "").trim() : "";
    const regNorm = regBody.toLowerCase().replace(/\s+/g, "");
    const regHas = (p) => new RegExp(p, "i").test(regNorm);

    const cancelMatch = String(code || "").match(/function\s+cancel\s*\([^)]*\)\s*\{([\s\S]*?)\}/i);
    const cancelBody = cancelMatch ? cancelMatch[1].replace(/\/\/[^\n]*/g, "").trim() : "";
    const cancelNorm = cancelBody.toLowerCase().replace(/\s+/g, "");
    const cancelHas = (p) => new RegExp(p, "i").test(cancelNorm);

    const hasInc = regHas("count\\+\\+") || regHas("\\+\\+count") || regHas("count\\+=1") || regHas("count=count\\+1");
    const hasDec = cancelHas("count--") || cancelHas("--count") || cancelHas("count-=1") || cancelHas("count=count-1");
    const hasMaxCheck = regHas("5") || regHas("<5") || regHas("<=5") || regHas("==5") || regHas("===5");
    const hasMinCheck = cancelHas("0") || cancelHas(">0") || cancelHas(">=0") || cancelHas("==0") || cancelHas("===0");
    const hasMsgFull = regHas("full") || regHas("registrationfull");
    const hasMsgOpen = cancelHas("open") || cancelHas("registrationisopen");

    const tc2 = Boolean(regBody.length > 5 && hasInc);
    const tc3 = Boolean(regBody.length > 5 && hasInc && hasMaxCheck && hasMsgFull);
    const tc4 = Boolean(regBody.length > 5 && hasMaxCheck);
    const tc5 = Boolean(cancelBody.length > 5 && hasDec && hasMinCheck && hasMsgOpen);

    return [tc1, tc2, tc3, tc4, tc5];
  };

  const checkVm = (code) => {
    const scriptMatch = String(code || "").match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) return [false, false, false, false, false];
    const js = scriptMatch[1];

    let countValue = "0";
    let messageValue = "Registration is open";
    const elements = {
      count: {
        id: "count",
        get innerHTML() { return countValue; },
        set innerHTML(v) { countValue = String(v); },
        get textContent() { return countValue; },
        set textContent(v) { countValue = String(v); },
        get innerText() { return countValue; },
        set innerText(v) { countValue = String(v); },
      },
      message: {
        id: "message",
        get innerHTML() { return messageValue; },
        set innerHTML(v) { messageValue = String(v); },
        get textContent() { return messageValue; },
        set textContent(v) { messageValue = String(v); },
        get innerText() { return messageValue; },
        set innerText(v) { messageValue = String(v); },
      }
    };

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelector: (sel) => {
          if (typeof sel === "string" && sel.startsWith("#")) return elements[sel.slice(1)] || null;
          return null;
        }
      },
      parseInt,
      parseFloat,
      Number,
      console: { log: () => {} }
    };

    try {
      vm.createContext(sandbox);
      vm.runInContext(js, sandbox, { timeout: 1000 });
    } catch {
      return [false, false, false, false, false];
    }

    const getCount = () => {
      const num = parseInt(String(elements.count.innerHTML).trim(), 10);
      return isNaN(num) ? -1 : num;
    };
    const getMsg = () => String(elements.message.innerHTML).toLowerCase();

    // TC 1: Initially count is 0 and message has open
    const tc1 = getCount() === 0 && (getMsg().includes("open") || getMsg().length === 0);

    if (typeof sandbox.register !== "function" || typeof sandbox.cancel !== "function") {
      return [tc1, false, false, false, false];
    }

    // TC 2: Click Register once -> count = 1
    try { sandbox.register(); } catch {}
    const tc2 = getCount() === 1;

    // TC 3: Click Register until 5 -> count = 5 and message shows full
    try {
      sandbox.register();
      sandbox.register();
      sandbox.register();
      sandbox.register();
    } catch {}
    const tc3 = getCount() === 5 && getMsg().includes("full");

    // TC 4: Register again -> count capped at 5
    try { sandbox.register(); } catch {}
    const tc4 = getCount() === 5;

    // TC 5: Cancel -> count 4 and message shows open; cancel many times -> count not below 0
    try { sandbox.cancel(); } catch {}
    const cancelWorked = getCount() === 4 && getMsg().includes("open");
    try {
      for (let i = 0; i < 10; i++) sandbox.cancel();
    } catch {}
    const minCapped = getCount() === 0;
    const tc5 = cancelWorked && minCapped;

    return [tc1, tc2, tc3, tc4, tc5];
  };

  const s = checkStatic(html);
  const v = checkVm(html);
  return s.map((r, i) => r || v[i]);
}

function evaluateTrafficCode(html) {
  const checkStatic = (code) => {
    const norm = String(code || "").toLowerCase().replace(/\s+/g, "");
    const has = (p) => new RegExp(p, "i").test(norm);
    const hasRedId = has('id=["\']?red');
    const hasYellowId = has('id=["\']?yellow');
    const hasGreenId = has('id=["\']?green');
    const tc1 = hasRedId && hasYellowId && hasGreenId;

    const bodyMatch = String(code || "").match(/function\s+changeSignal\s*\([^)]*\)\s*\{([\s\S]*?)\}/i);
    const body = bodyMatch ? bodyMatch[1].replace(/\/\/[^\n]*/g, "").trim() : "";
    const bodyNorm = body.toLowerCase().replace(/\s+/g, "");
    const bodyHas = (p) => new RegExp(p, "i").test(bodyNorm);

    const hasChangeSignal = Boolean(body.length > 5);
    const hasSignalInc = bodyHas("signal\\+\\+") || bodyHas("\\+\\+signal") || bodyHas("signal=signal\\+1") || bodyHas("signal\\+=1") || bodyHas("signal%3") || bodyHas("\\(signal\\+1\\)%3");
    const hasRedLogic = bodyHas("red") && (bodyHas("background") || bodyHas("style") || bodyHas("class") || bodyHas("color"));
    const hasYellowLogic = bodyHas("yellow") && (bodyHas("background") || bodyHas("style") || bodyHas("class") || bodyHas("color"));
    const hasGreenLogic = bodyHas("green") && (bodyHas("background") || bodyHas("style") || bodyHas("class") || bodyHas("color"));
    const hasCycleLogic = hasSignalInc || bodyHas("signal=0") || bodyHas("signal=1") || bodyHas("signal%3");

    return [
      tc1,
      hasChangeSignal && hasRedLogic,
      hasChangeSignal && hasYellowLogic,
      hasChangeSignal && hasGreenLogic,
      hasChangeSignal && hasCycleLogic && (hasRedLogic || bodyHas("red"))
    ];
  };

  const checkVm = (code) => {
    const scriptMatch = String(code || "").match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) return [false, false, false, false, false];
    const js = scriptMatch[1];

    const elements = {
      red: { id: "red", style: { backgroundColor: "gray" }, className: "light" },
      yellow: { id: "yellow", style: { backgroundColor: "gray" }, className: "light" },
      green: { id: "green", style: { backgroundColor: "gray" }, className: "light" },
      message: { id: "message", textContent: "Ready" }
    };

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelector: (sel) => {
          if (typeof sel === "string" && sel.startsWith("#")) return elements[sel.slice(1)] || null;
          return null;
        }
      },
      console: { log: () => {} }
    };

    try {
      vm.createContext(sandbox);
      vm.runInContext(js, sandbox, { timeout: 1000 });
    } catch {
      return [false, false, false, false, false];
    }

    const isColor = (el, targetColor) => {
      const bg = String(el.style.backgroundColor || el.style.background || "").toLowerCase().replace(/\s+/g, "");
      const cls = String(el.className || "").toLowerCase();
      if (targetColor === "red") {
        return bg.includes("red") || bg.includes("rgb(255,0,0)") || bg.includes("#f00") || bg.includes("#ff0000") || cls.includes("red");
      }
      if (targetColor === "yellow") {
        return bg.includes("yellow") || bg.includes("rgb(255,255,0)") || bg.includes("#ff0") || bg.includes("#ffff00") || cls.includes("yellow");
      }
      if (targetColor === "green") {
        return bg.includes("green") || bg.includes("rgb(0,128,0)") || bg.includes("rgb(0,255,0)") || bg.includes("#0f0") || bg.includes("#00ff00") || cls.includes("green");
      }
      return false;
    };

    const isRed = () => isColor(elements.red, "red");
    const isYellow = () => isColor(elements.yellow, "yellow");
    const isGreen = () => isColor(elements.green, "green");

    const tc1 = !isRed() && !isYellow() && !isGreen();
    if (typeof sandbox.changeSignal !== "function") return [tc1, false, false, false, false];

    try { sandbox.changeSignal(); } catch {}
    const tc2 = isRed() && !isYellow() && !isGreen();

    try { sandbox.changeSignal(); } catch {}
    const tc3 = isYellow() && !isRed() && !isGreen();

    try { sandbox.changeSignal(); } catch {}
    const tc4 = isGreen() && !isRed() && !isYellow();

    try { sandbox.changeSignal(); } catch {}
    const tc5 = isRed() && !isYellow() && !isGreen();

    return [tc1, tc2, tc3, tc4, tc5];
  };

  const s = checkStatic(html);
  const v = checkVm(html);
  return s.map((r, i) => r || v[i]);
}

function evaluateWaterCode(html) {
  const checkStatic = (code) => {
    const norm = String(code || "").toLowerCase().replace(/\s+/g, "");
    const has = (p) => new RegExp(p, "i").test(norm);
    const tc1 = has('id=["\']?count') && has('>0<');

    const addMatch = String(code || "").match(/function\s+addWater\s*\([^)]*\)\s*\{([\s\S]*?)\}/i);
    const addBody = addMatch ? addMatch[1].replace(/\/\/[^\n]*/g, "").trim() : "";
    const addNorm = addBody.toLowerCase().replace(/\s+/g, "");
    const addHas = (p) => new RegExp(p, "i").test(addNorm);

    const resetMatch = String(code || "").match(/function\s+resetCount\s*\([^)]*\)\s*\{([\s\S]*?)\}/i);
    const resetBody = resetMatch ? resetMatch[1].replace(/\/\/[^\n]*/g, "").trim() : "";
    const resetNorm = resetBody.toLowerCase().replace(/\s+/g, "");
    const resetHas = (p) => new RegExp(p, "i").test(resetNorm);

    const hasIncrement = addHas("glasses\\+\\+") || addHas("\\+\\+glasses") || addHas("glasses\\+=1") || addHas("glasses=glasses\\+1") || addHas("count\\+\\+") || addHas("count\\+=1");
    const hasAddDom = (addHas("textcontent") || addHas("innertext") || addHas("innerhtml")) && addHas("count");
    const tc2 = Boolean(addBody.length > 5 && hasIncrement && hasAddDom);
    const tc3 = tc2;

    const hasReset = resetHas("glasses=0") || resetHas("count=0") || resetHas("textcontent=0") || resetHas('textcontent="0"') || resetHas("textcontent='0'");
    const hasResetDom = (resetHas("textcontent") || resetHas("innertext") || resetHas("innerhtml")) && resetHas("count");
    const tc4 = Boolean(resetBody.length > 5 && hasReset && hasResetDom);
    const tc5 = tc2 && tc4;

    return [tc1, tc2, tc3, tc4, tc5];
  };

  const checkVm = (code) => {
    const scriptMatch = String(code || "").match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) return [false, false, false, false, false];
    const js = scriptMatch[1];

    const elements = {
      count: { id: "count", textContent: "0", innerText: "0", innerHTML: "0" },
      message: { id: "message", textContent: "Keep drinking water!" }
    };

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelector: (sel) => {
          if (typeof sel === "string" && sel.startsWith("#")) return elements[sel.slice(1)] || null;
          return null;
        }
      },
      console: { log: () => {} }
    };

    try {
      vm.createContext(sandbox);
      vm.runInContext(js, sandbox, { timeout: 1000 });
    } catch {
      return [false, false, false, false, false];
    }

    const getCount = () => {
      const val = elements.count.textContent ?? elements.count.innerText ?? elements.count.innerHTML;
      const num = parseInt(String(val).trim(), 10);
      return isNaN(num) ? -1 : num;
    };

    const tc1 = getCount() === 0;
    if (typeof sandbox.addWater !== "function" || typeof sandbox.resetCount !== "function") {
      return [tc1, false, false, false, false];
    }

    try { sandbox.addWater(); } catch {}
    const tc2 = getCount() === 1;

    try { sandbox.addWater(); sandbox.addWater(); } catch {}
    const tc3 = getCount() === 3;

    elements.count.textContent = "5";
    try { sandbox.resetCount(); } catch {}
    const tc4 = getCount() === 0;

    try { sandbox.addWater(); } catch {}
    const tc5 = getCount() === 1;

    return [tc1, tc2, tc3, tc4, tc5];
  };

  const s = checkStatic(html);
  const v = checkVm(html);
  return s.map((r, i) => r || v[i]);
}

function level2TestCaseResults(questionId, answer) {
  if (questionId === "bulb-1") return evaluateBulbCode(answer);
  if (questionId === "canteen-1") return evaluateCanteenCode(answer);
  if (questionId === "event-1") return evaluateEventCode(answer);
  if (questionId === "traffic-1") return evaluateTrafficCode(answer);
  if (questionId === "water-1") return evaluateWaterCode(answer);
  const patterns = content.level2Patterns[questionId] || [];
  const normalized = normalizeAnswer(answer);
  const groups = LEVEL2_CASE_PATTERN_GROUPS[questionId] || [];
  return groups.map((group) => group.every((patternIndex) => {
    const pattern = patterns[patternIndex];
    return Boolean(pattern && new RegExp(pattern).test(normalized));
  }));
}

function level2AttemptResults(row) {
  let testsPassed = 0;
  for (const task of row.questions || []) {
    for (const question of task.questions || []) {
      const savedCases = row.caseGrades?.[question.id];
      const passed = Array.isArray(savedCases)
        ? savedCases.filter(Boolean).length
        : row.submittedAt !== null
          ? (row.grades?.[question.id] ? 5 : 0) // Preserve the old all-or-nothing result for existing attempts.
          : level2TestCaseResults(question.id, row.answers?.[question.id] || "").filter(Boolean).length;
      testsPassed += passed;
    }
  }
  return { testsPassed, score: testsPassed * 2 };
}

function level3AttemptResults(row) {
  let testsPassed = 0;
  for (const task of row.questions || []) {
    for (const question of task.questions || []) {
      const answer = row.answers?.[question.id] || {};
      const run = row.level3Runs?.[question.id];
      const currentFingerprint = answerFingerprint(answerLanguage(answer), answerSource(answer), answerMode(answer));
      if (run?.sourceHash === currentFingerprint) testsPassed += (row.caseGrades?.[question.id] || []).filter(Boolean).length;
    }
  }
  return { testsPassed, score: testsPassed * 5 };
}

function level3QuestionPairs() {
  const pairs = [];
  for (let first = 0; first < content.level3Questions.length; first += 1) {
    for (let second = first + 1; second < content.level3Questions.length; second += 1) {
      pairs.push([content.level3Questions[first].id, content.level3Questions[second].id]);
    }
  }
  return pairs;
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = crypto.randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function findLevel3Question(questionId) {
  const normalizedId = questionId === "beautiful-array" ? "good-pairs" : questionId;
  return content.level3Questions.find((item) => item.id === normalizedId) || content.level3Questions[0];
}

async function assignLevel3Questions(user) {
  const assignments = db.collection("level3_assignments");
  const existing = await assignments.findOne({ _id: user._id });
  if (existing?.questionIds?.length === 2) {
    return existing.questionIds.map((id) => (id === "beautiful-array" ? "good-pairs" : id));
  }

  const pairOrderSettings = db.collection("settings");
  let orderDoc = await pairOrderSettings.findOne({ _id: "level3_pair_order" });
  if (!orderDoc || !Array.isArray(orderDoc.pairs) || JSON.stringify(orderDoc.pairs).includes("beautiful-array")) {
    const pairs = shuffled(level3QuestionPairs());
    await pairOrderSettings.updateOne({ _id: "level3_pair_order" }, {
      $set: { pairs, updatedAt: new Date() },
    }, { upsert: true });
    orderDoc = { pairs };
  }
  const pairs = orderDoc.pairs;
  const counter = await pairOrderSettings.findOneAndUpdate({ _id: "level3_assignment_counter" }, {
    $inc: { value: 1 },
  }, { upsert: true, returnDocument: "after" });
  const assignmentNumber = Number(counter?.value || 1) - 1;
  const selectedPair = pairs[assignmentNumber % pairs.length];
  const questionIds = shuffled(selectedPair).map((id) => (id === "beautiful-array" ? "good-pairs" : id));
  try {
    await assignments.insertOne({ _id: user._id, questionIds, assignedAt: new Date(), cycle: Math.floor(assignmentNumber / pairs.length) });
    return questionIds;
  } catch (error) {
    if (error.code !== 11000) throw error;
    const raced = await assignments.findOne({ _id: user._id });
    if (raced?.questionIds?.length === 2) {
      return raced.questionIds.map((id) => (id === "beautiful-array" ? "good-pairs" : id));
    }
    throw error;
  }
}

function publicLevel3Tasks(questionIds) {
  return (questionIds || []).map((rawId, index) => {
    const questionId = rawId === "beautiful-array" ? "good-pairs" : rawId;
    const source = findLevel3Question(questionId);
    const question = {
      id: source.id,
      title: source.title,
      prompt: source.prompt,
      inputFormat: source.inputFormat,
      outputFormat: source.outputFormat,
      examples: source.examples,
      starterCode: source.starterCode || {},
      publicTests: source.tests.filter((test) => test.public).map(({ label, input, expected }) => ({ label, input, expected })),
    };
    return { id: `level3-${index + 1}`, title: `Question ${index + 1}`, questions: [question] };
  });
}

// Level 3 runner functions (executeLevel3Tests, executeLevel3Debug, level3OutputPasses,
// buildLevel3FunctionProgram, judgeLanguageIds) are imported from ./level3Runner

function answerIsCorrect(questionId, answer) {
  const normalized = normalizeAnswer(answer);
  const level2Patterns = content.level2Patterns[questionId];
  if (level2Patterns) return level2TestCaseResults(questionId, answer).every(Boolean);
  const patterns = content.answerPatterns[questionId] || [];
  if (questionId === "c-1" || questionId === "c-2" || questionId === "c-3" || questionId === "c-4" || questionId === "dbms-1" || questionId === "dbms-2") {
    return patterns.some((pattern) => new RegExp(pattern).test(normalized));
  }
  if (questionId === "c-5") {
    const changesValue = ["\\*x\\+\\+", "\\+\\+\\(\\*x\\)", "\\*x\\+=1", "\\*x=\\*x\\+1", "\\*x\\+=2", "\\*x=\\*x\\+2"].some((pattern) => new RegExp(pattern).test(normalized));
    return patterns.every((pattern) => new RegExp(pattern).test(normalized)) && changesValue;
  }
  if (questionId === "dsa-3") return patterns.every((pattern) => new RegExp(pattern).test(normalized));
  if (questionId === "dsa-5") {
    const positions = ["next=cur->next", "cur->next=prev", "cur=next"].map((pattern) => normalized.indexOf(pattern));
    return Math.min(...positions) >= 0 && positions.every((position, index) => index === 0 || positions[index - 1] <= position);
  }
  if (questionId === "python-4") return /globalpoints/.test(normalized) || /globalx/.test(normalized);
  return patterns.some((pattern) => new RegExp(pattern).test(normalized));
}

function publicTaskSet(level, studyYear) {
  const source = level === 2 ? content.level2Tasks : content.tasks;
  return source.map((task) => {
    const questions = level === 2 || studyYear === 1
      ? task.questions
      : [task.questions[crypto.randomInt(task.questions.length)]];
    return { id: task.id, title: task.title, questions };
  });
}

async function getActiveAttempt(user, level) {
  const query = { userId: user._id, studyYear: user.sessionStudyYear, submittedAt: null };
  if (level) query.level = level;
  return db.collection("attempts").find(query).sort({ startedAt: -1 }).limit(1).next();
}

async function studentProgress(user) {
  const attempts = db.collection("attempts");
  const [level1Attempt, level2Attempt, level3Attempt] = await Promise.all([
    attempts.findOne({ userId: user._id, level: 1, submittedAt: { $ne: null } }, { projection: { _id: 1 } }),
    attempts.findOne({ userId: user._id, level: 2, submittedAt: { $ne: null } }, { projection: { _id: 1 } }),
    attempts.findOne({ userId: user._id, level: 3, submittedAt: { $ne: null } }, { projection: { _id: 1 } }),
  ]);
  const level1Completed = Boolean(level1Attempt);
  const level2Completed = Boolean(level2Attempt);
  const level3Completed = Boolean(level3Attempt);
  return {
    level1Completed,
    level2Completed,
    level3Completed,
    level1Unlocked: !level1Completed && !level2Completed && !level3Completed,
    level2Unlocked: level1Completed && !level2Completed && !level3Completed,
    level3Unlocked: level2Completed && !level3Completed,
  };
}

function countAnswered(answers) {
  return Object.values(answers || {}).filter((answer) => answerSource(answer).trim()).length;
}

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/api/admin/me", async (req, res, next) => {
  try { res.json({ authenticated: Boolean(await currentAdmin(req)) }); } catch (error) { next(error); }
});

app.get("/api/admin/runner-status", async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    res.json({
      preference: process.env.RUNNER_PREFERENCE || "local,remote",
      localSupportedLanguages: getLocalSupportedLanguages(),
      localTools: LOCAL_TOOLS,
      judge0Primary: process.env.JUDGE0_URL || "https://ce.judge0.com",
      judge0Fallbacks: (process.env.JUDGE0_FALLBACK_URLS || "").split(",").map((s) => s.trim()).filter(Boolean),
    });
  } catch (error) { next(error); }
});

app.get("/api/me", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    const progress = user ? await studentProgress(user) : { level1Completed: false, level2Completed: false, level3Completed: false, level1Unlocked: false, level2Unlocked: false, level3Unlocked: false };
    res.json({ authenticated: Boolean(user), registrationNumber: user?.registrationNumber || null, fullName: user?.fullName || null, studyYear: user?.sessionStudyYear || null, progress });
  } catch (error) { next(error); }
});

app.get("/api/attempt", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in first." });
    const requestedLevel = ["1", "2", "3"].includes(req.query.level) ? Number(req.query.level) : null;
    const progress = await studentProgress(user);
    if (requestedLevel && !progress[`level${requestedLevel}Unlocked`]) return res.json({ attempt: null });
    let attempt = requestedLevel
      ? await getActiveAttempt(user, requestedLevel)
      : progress.level1Unlocked
        ? await getActiveAttempt(user, 1)
        : progress.level2Unlocked
          ? await getActiveAttempt(user, 2)
          : progress.level3Unlocked
            ? await getActiveAttempt(user, 3)
          : null;
    if (!attempt) return res.json({ attempt: null });
    return res.json({ attempt: {
      id: attempt.attemptId,
      level: attempt.level,
      expiresAt: attempt.expiresAt,
      tasks: attempt.level === 3
        ? publicLevel3Tasks(attempt.questions.flatMap((task) => task.questions.map((question) => question.id)))
        : attempt.questions,
      answers: attempt.answers || {},
      integrityViolations: Number(attempt.integrityViolations || 0),
      submitted: nowSeconds() >= attempt.expiresAt,
    } });
  } catch (error) { next(error); }
});

app.get("/api/leaderboard", async (req, res, next) => {
  try {
    const requested = Number(req.query.level || 1);
    const level = LEVEL_SECONDS[requested] ? requested : 1;
    const rows = await db.collection("attempts").aggregate([
      { $match: { level, submittedAt: { $ne: null } } },
      { $sort: { submittedAt: -1 } },
      { $limit: 1000 },
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
    ]).toArray();
    const results = rows.filter((row) => Object.keys(row.grades || {}).length > 0).map((row) => {
      const testResult = level === 2 ? level2AttemptResults(row) : level === 3 ? level3AttemptResults(row) : null;
      const correct = testResult
        ? testResult.testsPassed
        : Object.values(row.grades).filter(Boolean).length;
      return {
        name: row.user.fullName || row.user.registrationNumber,
        studyYear: row.studyYear,
        level: row.level,
        correct,
        score: testResult ? testResult.score : correct * 5,
        seconds: Math.max(0, row.submittedAt - row.startedAt),
        submittedAt: row.submittedAt,
      };
    });
    results.sort((a, b) => b.score - a.score || a.seconds - b.seconds || a.submittedAt - b.submittedAt);
    res.json({ leaderboard: results.slice(0, 50) });
  } catch (error) { next(error); }
});

app.get("/api/admin/dashboard", async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    const requested = Number(req.query.level || 1);
    const level = LEVEL_SECONDS[requested] ? requested : 1;
    const [users, attempts, activeSessions] = await Promise.all([
      db.collection("users").find({}, { projection: { fullName: 1, registrationNumber: 1, studyYear: 1 } }).toArray(),
      db.collection("attempts").aggregate([
        { $match: { level } },
        { $sort: { startedAt: -1 } },
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
      ]).toArray(),
      db.collection("sessions").find({ expiresAt: { $gt: new Date() }, lastSeen: { $gt: new Date(Date.now() - 45_000) } }).toArray(),
    ]);

    const cohorts = Object.fromEntries([1, 2, 3].map((year) => [year, {
      registered: 0, loggedIn: 0, attempted: 0, completed: 0, inProgress: 0,
      questionCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
    }]));
    const cohortUsers = Object.fromEntries([1, 2, 3].map((year) => [year, {
      attempted: new Set(), completed: new Set(), inProgress: new Set(), questions: { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() },
    }]));
    for (const user of users) if (cohorts[user.studyYear]) cohorts[user.studyYear].registered += 1;
    const activeUserIds = new Set();
    for (const session of activeSessions) {
      const year = [1, 2, 3].includes(session.studyYear) ? session.studyYear : null;
      if (cohorts[year] && !activeUserIds.has(String(session.userId))) {
        cohorts[year].loggedIn += 1;
        activeUserIds.add(String(session.userId));
      }
    }

    const seenAttempted = { 1: new Set(), 2: new Set(), 3: new Set() };
    const latestAttemptUsers = { 1: new Set(), 2: new Set(), 3: new Set() };
    const leaderboard = [];
    for (const row of attempts) {
      const year = [1, 2, 3].includes(row.studyYear) ? row.studyYear : null;
      const userKey = String(row.userId);
      const answers = row.answers || {};
      const answered = countAnswered(answers);
      const submitted = row.submittedAt !== null;
      if (year) {
        seenAttempted[year].add(userKey);
        if (submitted) cohortUsers[year].completed.add(userKey);
        else cohortUsers[year].inProgress.add(userKey);
        if (!latestAttemptUsers[year].has(userKey) && answered >= 1 && answered <= 4) cohortUsers[year].questions[answered].add(userKey);
        latestAttemptUsers[year].add(userKey);
      }
      const questionIds = row.questions.flatMap((task) => task.questions.map((question) => question.id));
      const testResult = level === 2 ? level2AttemptResults(row) : level === 3 ? level3AttemptResults(row) : null;
      const correct = testResult
        ? testResult.testsPassed
        : submitted
          ? Object.values(row.grades || {}).filter(Boolean).length
          : questionIds.filter((id) => String(answers[id] || "").trim() && answerIsCorrect(id, answers[id])).length;
      const seconds = Math.max(0, (row.submittedAt || nowSeconds()) - row.startedAt);
      leaderboard.push({
        name: row.user.fullName || row.user.registrationNumber,
        registrationNumber: row.user.registrationNumber,
        year,
        answered,
        correct,
        score: testResult ? testResult.score : correct * 5,
        maxScore: level === 3 ? 50 : level === 2 ? 30 : 20,
        seconds,
        status: submitted ? "Completed" : "In progress",
        submittedAt: row.submittedAt,
      });
    }
    for (const year of [1, 2, 3]) {
      cohorts[year].attempted = seenAttempted[year].size;
      cohorts[year].completed = cohortUsers[year].completed.size;
      cohorts[year].inProgress = [...cohortUsers[year].inProgress].filter((id) => !cohortUsers[year].completed.has(id)).length;
      for (let count = 1; count <= 4; count += 1) cohorts[year].questionCounts[count] = cohortUsers[year].questions[count].size;
    }
    leaderboard.sort((a, b) => b.score - a.score || b.answered - a.answered || a.seconds - b.seconds);
    res.json({ level, cohorts, leaderboard: leaderboard.slice(0, 100), updatedAt: nowSeconds() });
  } catch (error) { next(error); }
});

app.post("/api/admin/login", async (req, res, next) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const envUsername = String(process.env.ADMIN_USERNAME || "").trim();
    const envPassword = String(process.env.ADMIN_PASSWORD || "");

    if (!envUsername || !envPassword) {
      return res.status(500).json({ error: "ADMIN_USERNAME and ADMIN_PASSWORD are not configured in environment variables." });
    }

    if (username !== envUsername || password !== envPassword) {
      return res.status(401).json({ error: "Administrator username or password is incorrect." });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    await db.collection("admin_sessions").insertOne({
      tokenHash: hashToken(token),
      username: envUsername,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
    });
    sessionCookie(res, "mits_l1_admin", token, 8 * 60 * 60);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/admin/logout", async (req, res, next) => {
  try {
    const token = cookieValue(req, "mits_l1_admin");
    if (token) await db.collection("admin_sessions").deleteOne({ tokenHash: hashToken(token) });
    clearCookie(res, "mits_l1_admin");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

function studentYear(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (["1", "i", "1st", "first", "first year", "year 1"].includes(text)) return 1;
  if (["2", "ii", "2nd", "second", "second year", "year 2"].includes(text)) return 2;
  if (["3", "iii", "3rd", "third", "third year", "year 3"].includes(text)) return 3;
  return Number(text);
}

function studentRecord(body) {
  const registrationNumber = normalizeRegistrationNumber(body.registrationNumber ?? body.rollNumber);
  const studyYear = studentYear(body.studyYear ?? body.year);
  if (!registrationNumber) throw Object.assign(new Error("Enter a valid registration number."), { status: 400 });
  if (![1, 2, 3].includes(studyYear)) throw Object.assign(new Error("Year must be 1, 2, or 3."), { status: 400 });
  return { registrationNumber, studyYear };
}

const DEFAULT_STUDENT_PASSWORD = "tech@123";

function studentsWorkbook(rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Students");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

app.get("/api/admin/students", async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    const students = await db.collection("users").find({}, { projection: { registrationNumber: 1, fullName: 1, studyYear: 1, createdAt: 1 } }).sort({ studyYear: 1, registrationNumber: 1 }).toArray();
    res.json({ students });
  } catch (error) { next(error); }
});

app.get("/api/admin/students/template", async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    const buffer = studentsWorkbook([["Registration Number", "Year"]]);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", "attachment; filename=student-import-template.xlsx");
    res.send(buffer);
  } catch (error) { next(error); }
});

app.get("/api/admin/students/export", async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    const students = await db.collection("users").find({}, { projection: { registrationNumber: 1, fullName: 1, studyYear: 1 } }).sort({ studyYear: 1, registrationNumber: 1 }).toArray();
    const romanYear = (year) => ({ 1: "I", 2: "II", 3: "III" }[year] || "");
    const rows = [["Registration Number", "Year"], ...students.map((student) => [student.registrationNumber, romanYear(student.studyYear)])];
    const buffer = studentsWorkbook(rows);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", "attachment; filename=registered-students.xlsx");
    res.send(buffer);
  } catch (error) { next(error); }
});

app.post("/api/admin/students", async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    const record = studentRecord(req.body || {});
    const password = String(req.body.password || DEFAULT_STUDENT_PASSWORD);
    if (password.length < 8 || password.length > 1024) return res.status(400).json({ error: "Student password must be 8–1024 characters." });
    const { passwordSalt, passwordHash } = await makePasswordHash(password);
    await db.collection("users").insertOne({ ...record, fullName: record.registrationNumber, passwordSalt, passwordHash, createdAt: nowSeconds() });
    res.status(201).json({ ok: true, student: record });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "That registration number is already registered." });
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.patch("/api/admin/students/:registrationNumber", async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    const oldRegistrationNumber = normalizeRegistrationNumber(req.params.registrationNumber);
    if (!oldRegistrationNumber) return res.status(400).json({ error: "Invalid existing registration number." });
    const record = studentRecord(req.body || {});
    const password = String(req.body.password || "");
    const previousStudent = await db.collection("users").findOne({ registrationNumber: oldRegistrationNumber }, { projection: { fullName: 1 } });
    if (!previousStudent) return res.status(404).json({ error: "Student not found." });
    const oldDisplayName = previousStudent.fullName || oldRegistrationNumber;
    const update = { ...record, fullName: oldDisplayName === oldRegistrationNumber ? record.registrationNumber : oldDisplayName, updatedAt: nowSeconds() };
    if (password) {
      if (password.length < 8 || password.length > 1024) return res.status(400).json({ error: "Student password must be 8–1024 characters." });
      Object.assign(update, await makePasswordHash(password));
    }
    const result = await db.collection("users").updateOne({ registrationNumber: oldRegistrationNumber }, { $set: update });
    if (!result.matchedCount) return res.status(404).json({ error: "Student not found." });
    res.json({ ok: true, student: record });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "That registration number is already registered." });
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.delete("/api/admin/students/:registrationNumber", async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    const registrationNumber = normalizeRegistrationNumber(req.params.registrationNumber);
    const users = db.collection("users");
    const student = await users.findOne({ registrationNumber });
    if (!student) return res.status(404).json({ error: "Student not found." });
    await Promise.all([
      users.deleteOne({ _id: student._id }),
      db.collection("sessions").deleteMany({ userId: student._id }),
      db.collection("attempts").deleteMany({ userId: student._id }),
    ]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/admin/students/import", express.raw({ type: ["application/octet-stream", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], limit: "5mb" }), async (req, res, next) => {
  try {
    if (!await currentAdmin(req)) return res.status(401).json({ error: "Administrator sign in required." });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "Choose an Excel workbook to import." });
    const workbook = XLSX.read(req.body, { type: "buffer", cellFormula: false, bookVBA: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({ error: "The workbook has no worksheet." });
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const headers = (rows.shift() || []).map((header) => String(header).trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
    const findColumn = (...names) => headers.findIndex((header) => names.includes(header));
    const columns = {
      registrationNumber: findColumn("registrationnumber", "rollnumber", "registrationno", "rollno"),
      year: findColumn("year", "studyyear", "yearofstudy"),
    };
    if (columns.registrationNumber < 0 || columns.year < 0) return res.status(400).json({ error: "Use the template headers Registration Number and Year. Imported accounts use the default password." });
    const dataRows = rows.filter((row) => row.some((value) => String(value).trim()));
    if (dataRows.length > 500) return res.status(400).json({ error: "Import up to 500 students per workbook." });
    const imported = [];
    const errors = [];
    for (const [index, row] of dataRows.entries()) {
      const line = index + 2;
      try {
        const record = studentRecord({
          registrationNumber: row[columns.registrationNumber],
          year: row[columns.year],
        });
        const password = DEFAULT_STUDENT_PASSWORD;
        if (password.length < 8 || password.length > 1024) throw new Error("Password must be 8–1024 characters.");
        const { passwordSalt, passwordHash } = await makePasswordHash(password);
        await db.collection("users").insertOne({ ...record, fullName: record.registrationNumber, passwordSalt, passwordHash, createdAt: nowSeconds() });
        imported.push(record.registrationNumber);
      } catch (error) {
        errors.push({ row: line, registrationNumber: String(row[columns.registrationNumber] || ""), error: error.code === 11000 ? "Registration number already exists." : error.message });
      }
    }
    res.json({ imported: imported.length, skipped: errors.length, errors });
  } catch (error) {
    if (error.name === "Error" && /zip|workbook|file|central directory|unexpected/i.test(error.message)) return res.status(400).json({ error: "That file is not a readable .xlsx workbook." });
    next(error);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const registrationNumber = normalizeRegistrationNumber(req.body.registrationNumber);
    const password = String(req.body.password || "");
    const selectedYear = studentYear(req.body.studyYear);
    if (![1, 2, 3].includes(selectedYear)) return res.status(400).json({ error: "Choose your year of study." });
    if (!registrationNumber || !password || password.length > 1024) return res.status(400).json({ error: "Enter your registration number and password." });
    const users = db.collection("users");
    const user = await users.findOne({ registrationNumber });
    if (!user || !await passwordMatches(password, user.passwordSalt, user.passwordHash)) return res.status(401).json({ error: "Registration number or password is incorrect." });
    const normalizedSavedYear = studentYear(user.studyYear);
    const savedYear = [1, 2, 3].includes(normalizedSavedYear) ? normalizedSavedYear : null;
    if (savedYear && savedYear !== selectedYear) return res.status(403).json({ error: "This account is registered for a different year of study." });
    const actualYear = savedYear || selectedYear;
    await users.updateOne({ _id: user._id }, { $set: { studyYear: actualYear } });
    const token = crypto.randomBytes(32).toString("base64url");
    const now = new Date();
    await db.collection("sessions").insertOne({ tokenHash: hashToken(token), userId: user._id, studyYear: actualYear, createdAt: now, lastSeen: now, expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) });
    sessionCookie(res, "mits_l1_sid", token, 7 * 24 * 60 * 60);
    res.json({ ok: true, registrationNumber: user.registrationNumber, fullName: user.fullName || user.registrationNumber, studyYear: actualYear });
  } catch (error) { next(error); }
});

app.post("/api/start-attempt", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in first." });
    const level = Number(req.body.level || 1);
    if (!LEVEL_SECONDS[level]) return res.status(400).json({ error: "Choose a valid level." });
    if (level === 2 || level === 3) {
      const expectedPin = String(process.env[`LEVEL_${level}_PIN`] || "");
      const suppliedPin = String(req.body.pin || "");
      if (!expectedPin.trim()) return res.status(503).json({ error: `Level ${level} access PIN is not configured. Set LEVEL_${level}_PIN in the server environment and restart.` });
      const expectedPinBytes = Buffer.from(expectedPin);
      const suppliedPinBytes = Buffer.from(suppliedPin);
      const pinMatches = expectedPinBytes.length === suppliedPinBytes.length && crypto.timingSafeEqual(expectedPinBytes, suppliedPinBytes);
      if (!pinMatches) return res.status(403).json({ error: `Incorrect PIN for Level ${level}.` });
    }
    const progress = await studentProgress(user);
    if (!progress[`level${level}Unlocked`]) {
      if (level === 2 && !progress.level1Completed) return res.status(403).json({ error: "Complete Level 1 first to unlock Level 2." });
      if (level === 1 && progress.level1Completed) return res.status(409).json({ error: "Level 1 is already completed and locked." });
      if (level === 2 && progress.level2Completed) return res.status(409).json({ error: "Level 2 is already completed and locked." });
      if (level === 3 && !progress.level2Completed) return res.status(403).json({ error: "Complete Level 2 first to unlock Level 3." });
      if (level === 3 && progress.level3Completed) return res.status(409).json({ error: "Level 3 is already completed and locked." });
      return res.status(403).json({ error: "This level is locked." });
    }
    let attempt = await getActiveAttempt(user, level);
    const now = nowSeconds();
    if (!attempt || now >= attempt.expiresAt) {
      const level3QuestionIds = level === 3 ? await assignLevel3Questions(user) : null;
      const attemptId = crypto.randomBytes(18).toString("base64url");
      attempt = {
        attemptId,
        userId: user._id,
        studyYear: user.sessionStudyYear,
        level,
        startedAt: now,
        expiresAt: now + LEVEL_SECONDS[level],
        questions: level === 3 ? publicLevel3Tasks(level3QuestionIds) : publicTaskSet(level, user.sessionStudyYear),
        answers: {},
        grades: {},
        caseGrades: {},
        submittedAt: null,
        submitReason: null,
      };
      await db.collection("attempts").insertOne(attempt);
    }
    res.json({
      id: attempt.attemptId,
      level: attempt.level,
      expiresAt: attempt.expiresAt,
      tasks: attempt.questions,
      answers: attempt.answers || {},
      studyYear: user.sessionStudyYear,
      integrityViolations: Number(attempt.integrityViolations || 0),
      marksPerAnswer: level === 3 ? 25 : level === 2 ? 10 : 5,
      maxScore: level === 3 ? 50 : level === 2 ? 30 : 20,
    });
  } catch (error) { next(error); }
});

app.post("/api/run-level3", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in first." });
    const attempt = await db.collection("attempts").findOne({
      attemptId: String(req.body.attemptId || ""),
      userId: user._id,
      studyYear: user.sessionStudyYear,
      level: 3,
      submittedAt: null,
      expiresAt: { $gt: nowSeconds() },
    });
    if (!attempt) return res.status(409).json({ error: "This Level 3 attempt is no longer active." });
    const questionId = String(req.body.questionId || "");
    if (!attempt.questions.some((task) => task.questions.some((question) => question.id === questionId))) return res.status(400).json({ error: "That question is not part of this attempt." });
    const language = String(req.body.language || "");
    const mode = req.body.mode === "function" ? "function" : "program";
    const source = String(req.body.source || "");
    if (!source.trim() || source.length > 30000) return res.status(400).json({ error: "Enter a solution under 30,000 characters." });
    if (!Number.isInteger(Number(judgeLanguageIds()[language]))) return res.status(400).json({ error: "Choose a supported programming language." });
    const question = findLevel3Question(questionId);
    if (mode === "function" && !question?.starterCode?.[language]) return res.status(400).json({ error: "Function mode is not configured for this language. Choose a complete-program language or load a function starter." });
    const fingerprint = answerFingerprint(language, source, mode);
    const cachedRun = attempt.level3Runs?.[questionId];
    if (cachedRun?.verifierVersion === LEVEL3_VERIFIER_VERSION && cachedRun.sourceHash === fingerprint && Array.isArray(cachedRun.passed) && cachedRun.passed.length === 5) {
      const question = findLevel3Question(questionId);
      const tests = question.tests.map((test, index) => ({ label: test.public ? test.label : `Hidden test ${index + 1}`, public: Boolean(test.public), passed: Boolean(cachedRun.passed[index]), marks: cachedRun.passed[index] ? 5 : 0 }));
      return res.json({ tests, score: cachedRun.passed.filter(Boolean).length * 5, maxScore: 25, cached: true });
    }
    let caseResults;
    try {
      caseResults = await executeLevel3Tests(questionId, language, source, mode);
    } catch (error) {
      console.error("Level 3 code runner failed:", error.message);
      return res.status(503).json({ error: `The code runner is unavailable. ${error.message}` });
    }
    const runRecord = { language, mode, sourceHash: fingerprint, verifierVersion: LEVEL3_VERIFIER_VERSION, passed: caseResults.map((item) => item.passed), ranAt: nowSeconds() };
    await db.collection("attempts").updateOne({ _id: attempt._id, submittedAt: null }, {
      $set: {
        [`level3Runs.${questionId}`]: runRecord,
        [`answers.${questionId}`]: { language, source, mode },
        [`caseGrades.${questionId}`]: runRecord.passed,
      },
    });
    res.json({ tests: caseResults.map((item) => ({ label: item.label, public: item.public, passed: item.passed, marks: item.passed ? 5 : 0, actual: item.actual, runnerStatus: item.runnerStatus, detail: item.detail })), score: runRecord.passed.filter(Boolean).length * 5, maxScore: 25 });
  } catch (error) { next(error); }
});

app.post("/api/debug-level3", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in first." });
    const attempt = await db.collection("attempts").findOne({ attemptId: String(req.body.attemptId || ""), userId: user._id, studyYear: user.sessionStudyYear, level: 3, submittedAt: null, expiresAt: { $gt: nowSeconds() } }, { projection: { questions: 1 } });
    if (!attempt) return res.status(409).json({ error: "This Level 3 attempt is no longer active." });
    const questionId = String(req.body.questionId || "");
    if (!attempt.questions.some((task) => task.questions.some((question) => question.id === questionId))) return res.status(400).json({ error: "That question is not part of this attempt." });
    const source = String(req.body.source || "");
    const stdin = String(req.body.stdin || "");
    const language = String(req.body.language || "");
    const mode = req.body.mode === "function" ? "function" : "program";
    if (!source.trim() || source.length > 30000) return res.status(400).json({ error: "Enter a solution under 30,000 characters." });
    if (stdin.length > 10000) return res.status(400).json({ error: "Custom input must be under 10,000 characters." });
    let result;
    try {
      if (mode === "function") {
        const question = findLevel3Question(questionId);
        if (!question?.starterCode?.[language]) return res.status(400).json({ error: "Function mode is not configured for this language." });
        result = await executeLevel3Debug(language, buildLevel3FunctionProgram(questionId, language, source, [stdin]), "");
        if (result.passed) {
          try {
            const [entry] = JSON.parse(result.stdout);
            result.stdout = entry?.ok ? String(entry.output || "") : "";
            if (!entry?.ok) {
              result.passed = false;
              result.status = "Function error";
              result.stderr = String(entry?.error || "Function raised an error.");
            }
          } catch { result.stderr = "Function harness returned an invalid result."; result.passed = false; }
        }
      } else result = await executeLevel3Debug(language, source, stdin);
    }
    catch (error) {
      console.error("Level 3 debug run failed:", error.message);
      return res.status(503).json({ error: `The code runner is unavailable. ${error.message}` });
    }
    res.json(result);
  } catch (error) { next(error); }
});

app.post("/api/save-attempt", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in first." });
    const answers = req.body.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return res.status(400).json({ error: "Invalid answers." });
    const attemptId = String(req.body.attemptId || "");
    const attempt = await db.collection("attempts").findOne({ attemptId, userId: user._id, studyYear: user.sessionStudyYear, submittedAt: null }, { projection: { level: 1 } });
    if (!attempt) return res.status(409).json({ error: "This attempt can no longer be changed." });
    const progress = await studentProgress(user);
    if (!progress[`level${attempt.level}Unlocked`]) return res.status(403).json({ error: "This level is locked or has already been completed." });
    const result = await db.collection("attempts").updateOne({
      attemptId,
      userId: user._id,
      studyYear: user.sessionStudyYear,
      submittedAt: null,
      expiresAt: { $gt: nowSeconds() },
    }, { $set: { answers } });
    if (!result.matchedCount) return res.status(409).json({ error: "This attempt can no longer be changed." });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/attempt-violation", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in first." });
    const attemptId = String(req.body.attemptId || "");
    const reason = ["tab_switch", "fullscreen_exit"].includes(req.body.reason) ? req.body.reason : "tab_switch";
    const attempts = db.collection("attempts");
    const filter = {
      attemptId,
      userId: user._id,
      studyYear: user.sessionStudyYear,
      submittedAt: null,
      expiresAt: { $gt: nowSeconds() },
      $or: [{ integrityViolations: { $lt: 3 } }, { integrityViolations: { $exists: false } }],
    };
    const update = await attempts.updateOne(filter, {
      $inc: { integrityViolations: 1 },
      $set: { lastIntegrityViolation: reason, lastIntegrityViolationAt: nowSeconds() },
    });
    if (!update.modifiedCount) {
      const current = await attempts.findOne({ attemptId, userId: user._id, studyYear: user.sessionStudyYear, submittedAt: null }, { projection: { integrityViolations: 1 } });
      if (!current) return res.status(409).json({ error: "This attempt can no longer be changed." });
      if (Number(current.integrityViolations || 0) >= 3) return res.json({ count: 3, submit: true });
      return res.status(409).json({ error: "This attempt has expired." });
    }
    const current = await attempts.findOne({ attemptId, userId: user._id, studyYear: user.sessionStudyYear }, { projection: { integrityViolations: 1 } });
    res.json({ count: Number(current?.integrityViolations || 0), submit: Number(current?.integrityViolations || 0) >= 3 });
  } catch (error) { next(error); }
});

app.post("/api/submit-attempt", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Sign in first." });
    const answers = req.body.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return res.status(400).json({ error: "Invalid answers." });
    const attempts = db.collection("attempts");
    const attempt = await attempts.findOne({ attemptId: String(req.body.attemptId || ""), userId: user._id, studyYear: user.sessionStudyYear });
    if (!attempt) return res.status(404).json({ error: "Attempt not found." });
    if (attempt.submittedAt !== null) return res.status(409).json({ error: "This attempt was already submitted." });
    const progress = await studentProgress(user);
    if (!progress[`level${attempt.level}Unlocked`]) return res.status(403).json({ error: "This level is locked or has already been completed." });
    const timedOut = nowSeconds() >= attempt.expiresAt;
    const integrityAutoSubmit = Number(attempt.integrityViolations || 0) >= 3;
    if (!timedOut && !integrityAutoSubmit && countAnswered(answers) < attempt.questions.length) return res.status(400).json({ error: "Answer the required number of questions before submitting." });
    const grades = {};
    const caseGrades = {};
    const answersForGrading = answers;
    const level3Runs = { ...(attempt.level3Runs || {}) };
    for (const task of attempt.questions) {
      for (const question of task.questions) {
        if (attempt.level === 1 && user.sessionStudyYear === 1 && !Object.hasOwn(answersForGrading, question.id)) continue;
        if (attempt.level === 3) {
          const answer = answersForGrading[question.id] || attempt.answers?.[question.id] || {};
          const source = answerSource(answer);
          const language = answerLanguage(answer);
          let testCases = Array(question.publicTests?.length ? 5 : findLevel3Question(question.id)?.tests.length || 5).fill(false);
          if (source.trim() && language) {
            const mode = answerMode(answer);
            const fingerprint = answerFingerprint(language, source, mode);
            const savedRun = attempt.level3Runs?.[question.id];
            if (savedRun?.verifierVersion === LEVEL3_VERIFIER_VERSION && savedRun?.sourceHash === fingerprint && Array.isArray(savedRun.passed)) {
              testCases = savedRun.passed;
            } else if (!timedOut && !integrityAutoSubmit) {
              let results;
              try {
                results = await executeLevel3Tests(question.id, language, source, mode);
              } catch (error) {
                console.error("Level 3 code runner failed:", error.message);
                return res.status(503).json({ error: "The code runner is unavailable. Your attempt is still open; try submitting again shortly." });
              }
              testCases = results.map((item) => item.passed);
              level3Runs[question.id] = { language, mode, sourceHash: fingerprint, verifierVersion: LEVEL3_VERIFIER_VERSION, passed: testCases, ranAt: nowSeconds() };
            }
          }
          caseGrades[question.id] = testCases;
          grades[question.id] = testCases.every(Boolean);
          continue;
        }
        const testCases = attempt.level === 2
          ? level2TestCaseResults(question.id, String(answersForGrading[question.id] || ""))
          : null;
        const correct = testCases ? testCases.every(Boolean) : answerIsCorrect(question.id, String(answersForGrading[question.id] || ""));
        grades[question.id] = correct;
        if (testCases) caseGrades[question.id] = testCases;
      }
    }
    const submittedAt = nowSeconds();
    const reason = timedOut ? "timer" : integrityAutoSubmit ? "tab_switch" : "manual";
    const updateFields = { answers: answersForGrading, grades, submittedAt, submitReason: reason };
    if (attempt.level === 2 || attempt.level === 3) updateFields.caseGrades = caseGrades;
    if (attempt.level === 3) updateFields.level3Runs = level3Runs;
    const update = await attempts.updateOne({ attemptId: attempt.attemptId, userId: user._id, submittedAt: null }, { $set: updateFields });
    if (!update.modifiedCount) return res.status(409).json({ error: "This attempt was already submitted." });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/logout", async (req, res, next) => {
  try {
    const token = cookieValue(req, "mits_l1_sid");
    if (token) await db.collection("sessions").deleteOne({ tokenHash: hashToken(token) });
    clearCookie(res, "mits_l1_sid");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(ROOT, "static", "index.html"));
});

app.use((error, req, res, _next) => {
  console.error("Request failed:", error);
  if (res.headersSent) return;
  res.status(500).json({ error: "The server could not complete that request." });
});

async function start() {
  await client.connect();
  db = client.db(DB_NAME);
  await Promise.all([
    db.collection("users").createIndex({ registrationNumber: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("admin_sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("admin_sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("attempts").createIndex({ attemptId: 1 }, { unique: true }),
    db.collection("attempts").createIndex({ userId: 1, studyYear: 1, level: 1, submittedAt: 1, startedAt: -1 }),
    db.collection("attempts").createIndex({ level: 1, submittedAt: -1 }),
  ]);
  const adminUsername = String(process.env.ADMIN_USERNAME || "").trim();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");
  if (adminUsername && adminPassword) {
    console.log(`Administrator authentication active from environment (.env): ${adminUsername}`);
  } else {
    console.warn("WARNING: ADMIN_USERNAME or ADMIN_PASSWORD is not set in environment.");
  }
  const server = app.listen(PORT, HOST, () => {
    console.log(`MITS login is available at http://${HOST}:${PORT}`);
    console.log(`MongoDB database: ${DB_NAME}`);
    const localLangs = getLocalSupportedLanguages();
    console.log(`[Level 3 Runner] Active runner engines: ${process.env.RUNNER_PREFERENCE || "local,remote"}`);
    console.log(`[Level 3 Runner] Local native compilers detected (${localLangs.length}/6): ${localLangs.join(", ") || "none"}`);
  });
  const shutdown = async () => {
    server.close(async () => {
      await client.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = {
  app,
  evaluateCanteenCode,
  evaluateEventCode,
  level2TestCaseResults,
  answerIsCorrect
};

if (require.main === module) {
  start().catch(async (error) => {
    console.error("Could not start the MITS app.");
    if (error.name === "MongoServerSelectionError" || error.name === "MongoNetworkError") {
      console.error("MongoDB is not reachable. Check MONGODB_URI and Atlas network access settings.");
    }
    console.error(error.message);
    await client.close().catch(() => {});
    process.exit(1);
  });
}
