// routes/lenders.js
// Handlers for everything under /api/lenders. Plain functions, called
// from server.js's tiny router — no framework needed for a handful of routes.

const store = require("../db/store");

function uid() {
  return "l_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function emptyLender(overrides = {}) {
  return {
    id: uid(),
    name: "New Lender",
    calcBasis: "emi",
    category: "bt", // "bt" (balance transfer + top-up) or "refinance" (loan-closed vehicle)
    tiers: [{ id: "t1", minCibil: 700, minTenor: 0, multiplier: 1.0 }],
    minOwner: 1,
    maxOwner: 2,
    ageSalariedMin: 21,
    ageSalariedMax: 60,
    ageSenpMin: 21,
    ageSenpMax: 65,
    minTenorServed: 10,
    loanCapping: 0,
    maxTopupCap: 0,
    maxTopupMultipleOfEMI: null,
    requiresFoirMet: null,
    minABBMultiple: 0,
    requiresOwnedResi: false,
    requiresITR: false,
    irrRate: 15,
    pf: 1,
    notes: "",
    ...overrides,
  };
}

function list(req, res) {
  res.json(store.getLenders());
}

function create(req, res, body) {
  const lender = emptyLender(body || {});
  store.addLender(lender);
  res.status(201).json(lender);
}

function update(req, res, body, id) {
  const updated = store.updateLender(id, body || {});
  if (!updated) return res.status(404).json({ error: "Lender not found" });
  res.json(updated);
}

function remove(req, res, id) {
  const ok = store.deleteLender(id);
  if (!ok) return res.status(404).json({ error: "Lender not found" });
  res.status(204).end();
}

function reset(req, res) {
  const lenders = store.resetLendersToSeed();
  res.json(lenders);
}

module.exports = { list, create, update, remove, reset };
