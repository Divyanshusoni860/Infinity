// routes/check.js
const store = require("../db/store");
const { runEligibilityCheck, runRefinanceCheck } = require("../lib/eligibility");

function run(req, res, body) {
  const lenders = store.getLenders();
  const { input, eligible, ineligible } = runEligibilityCheck(lenders, body || {});

  const entry = {
    id: "h_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
    type: "bt",
    timestamp: new Date().toISOString(),
    input,
    eligibleCount: eligible.length,
    ineligibleCount: ineligible.length,
    bestLender: eligible[0] ? eligible[0].lenderName : null,
    bestTopup: eligible[0] ? eligible[0].topup : null,
  };
  store.appendHistory(entry);

  res.json({ input, eligible, ineligible });
}

function runRefinance(req, res, body) {
  const lenders = store.getLenders();
  const { input, eligible, ineligible } = runRefinanceCheck(lenders, body || {});

  const entry = {
    id: "h_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
    type: "refinance",
    timestamp: new Date().toISOString(),
    input,
    eligibleCount: eligible.length,
    ineligibleCount: ineligible.length,
    bestLender: eligible[0] ? eligible[0].lenderName : null,
    bestLoanAmount: eligible[0] ? eligible[0].loanAmount : null,
  };
  store.appendHistory(entry);

  res.json({ input, eligible, ineligible });
}

function history(req, res) {
  res.json(store.getHistory());
}

function clearHistory(req, res) {
  store.clearHistory();
  res.status(204).end();
}

module.exports = { run, runRefinance, history, clearHistory };
