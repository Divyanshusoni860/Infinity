// routes/applicants.js
// Handlers for /api/applicants — saved customer/applicant profiles.
// The idea: capture an applicant's details ONCE (name, contact, PAN,
// CIBIL, ITR/business info, FOIR, ABB, ownership, location) and reuse
// that profile to prefill any product check (BT top-up, refinance, and
// whatever gets added later) instead of re-typing the same fields.

const store = require("../db/store");

function uid() {
  return "a_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function emptyApplicant(overrides = {}) {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // --- contact / identity ---
    name: "",
    phone: "",
    email: "",
    location: "", // free-text city/state — used for the lender location filter

    // --- credit profile ---
    pan: "",
    cibil: null, // manual entry for now — no bureau API wired up yet
    cibilSource: "manual", // "manual" | "auto" (reserved for when a bureau pull is added)

    // --- income / employment ---
    employment: "salaried", // "salaried" | "senp"
    age: null,

    // --- ITR / business info ---
    itr: false,
    businessOwner: false,
    businessVintageYears: null, // how long the business has been running
    gstRegistered: false,
    gstBusinessName: "",

    // --- obligations & banking ---
    foirMet: null, // true/false — direct yes/no, used by the eligibility engine as-is
    foirPercent: null, // the raw FOIR/obligation % as stated — kept for reference, not yet auto-applied
    abbMultiple: null, // average bank balance expressed as a multiple of EMI — used directly by BT/refinance checks
    averageBankBalanceAmount: null, // raw ABB in ₹ (5th/15th/25th average) — informational, for when statement parsing is added
    bankStatementUploaded: false, // reserved — statement upload/parsing isn't wired up yet, manual entry above is the working path

    // --- ownership (reusable across car loan / refinance / etc.) ---
    resi: "owned", // "owned" | "rented"

    notes: "",

    ...overrides,
  };
}

function list(req, res) {
  res.json(store.getApplicants());
}

function get(req, res, id) {
  const applicant = store.getApplicant(id);
  if (!applicant) return res.status(404).json({ error: "Applicant not found" });
  res.json(applicant);
}

function create(req, res, body) {
  const applicant = emptyApplicant(body || {});
  store.addApplicant(applicant);
  res.status(201).json(applicant);
}

function update(req, res, body, id) {
  const patch = { ...(body || {}), updatedAt: new Date().toISOString() };
  const updated = store.updateApplicant(id, patch);
  if (!updated) return res.status(404).json({ error: "Applicant not found" });
  res.json(updated);
}

function remove(req, res, id) {
  const ok = store.deleteApplicant(id);
  if (!ok) return res.status(404).json({ error: "Applicant not found" });
  res.status(204).end();
}

module.exports = { list, get, create, update, remove };
