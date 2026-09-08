// db/store.js
// A tiny file-based "database". No native modules, no npm install —
// just reads and writes JSON files under /data. Good enough for a
// single-user desktop tool; swap this file out later for a real DB
// (SQLite/Postgres) without touching the routes or the frontend,
// since everything else only talks to the functions exported here.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const LENDERS_FILE = path.join(DATA_DIR, "lenders.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const SEED_FILE = path.join(__dirname, "lenders.seed.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, defaultContent) {
  ensureDataDir();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultContent, null, 2), "utf8");
  }
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  ensureDataDir();
  // write to a temp file then rename — avoids a half-written file
  // if the process gets killed mid-write
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function init() {
  const seed = fs.existsSync(SEED_FILE) ? readJSON(SEED_FILE) : [];
  ensureFile(LENDERS_FILE, seed);
  ensureFile(HISTORY_FILE, []);
}

// ---------- lenders ----------
function getLenders() {
  init();
  return readJSON(LENDERS_FILE);
}

function saveLenders(lenders) {
  writeJSON(LENDERS_FILE, lenders);
  return lenders;
}

function addLender(lender) {
  const lenders = getLenders();
  lenders.push(lender);
  saveLenders(lenders);
  return lender;
}

function updateLender(id, patch) {
  const lenders = getLenders();
  const idx = lenders.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  lenders[idx] = { ...lenders[idx], ...patch };
  saveLenders(lenders);
  return lenders[idx];
}

function deleteLender(id) {
  const lenders = getLenders();
  const next = lenders.filter((l) => l.id !== id);
  saveLenders(next);
  return next.length !== lenders.length;
}

function resetLendersToSeed() {
  const seed = fs.existsSync(SEED_FILE) ? readJSON(SEED_FILE) : [];
  saveLenders(seed);
  return seed;
}

// ---------- history ----------
function getHistory() {
  init();
  return readJSON(HISTORY_FILE);
}

function appendHistory(entry) {
  const history = getHistory();
  history.unshift(entry); // newest first
  const trimmed = history.slice(0, 200); // keep it bounded
  writeJSON(HISTORY_FILE, trimmed);
  return entry;
}

function clearHistory() {
  writeJSON(HISTORY_FILE, []);
}

module.exports = {
  init,
  getLenders,
  saveLenders,
  addLender,
  updateLender,
  deleteLender,
  resetLendersToSeed,
  getHistory,
  appendHistory,
  clearHistory,
};
