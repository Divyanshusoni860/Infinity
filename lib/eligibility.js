// lib/eligibility.js
// Pure, dependency-free eligibility engine.
// Given a lender policy object and a normalized applicant input,
// decides whether the applicant qualifies and, if so, computes the
// loan amount and top-up (cash-out) amount.

function getMultiplier(lender, cibil, tenorServed) {
  const applicable = lender.tiers.filter(
    (t) => cibil >= t.minCibil && tenorServed >= t.minTenor
  );
  if (applicable.length === 0) return null;
  return Math.max(...applicable.map((t) => t.multiplier));
}

// Location coverage is opt-in on both sides: if a lender hasn't listed any
// serviceable locations (the default), it's treated as serving everywhere.
// If the applicant hasn't given a location, the check is skipped too — this
// is scaffolding for a future location-based lender filter, not a hard gate.
function checkLocation(lender, input, reasons) {
  const coverage = Array.isArray(lender.serviceableLocations) ? lender.serviceableLocations : [];
  if (coverage.length === 0) return; // lender serves everywhere
  if (!input.location) return; // applicant didn't specify a location — don't block on it
  const loc = input.location.toLowerCase();
  const covered = coverage.some(
    (c) => c.toLowerCase() === loc || loc.includes(c.toLowerCase()) || c.toLowerCase().includes(loc)
  );
  if (!covered) {
    reasons.push(`Not serviceable in "${input.location}" (covers: ${coverage.join(", ")})`);
  }
}

function evaluateLender(lender, input) {
  const reasons = [];
  const multiplier = getMultiplier(lender, input.cibil, input.tenorServed);
  if (multiplier === null) {
    reasons.push("CIBIL score / repayment tenure below every eligible tier");
  }

  if (input.owner < lender.minOwner || input.owner > lender.maxOwner) {
    reasons.push(
      `Owner No. ${input.owner} not accepted (needs owner ${lender.minOwner}${
        lender.maxOwner !== lender.minOwner ? "–" + lender.maxOwner : ""
      })`
    );
  }

  const ageMin = input.employment === "salaried" ? lender.ageSalariedMin : lender.ageSenpMin;
  const ageMax = input.employment === "salaried" ? lender.ageSalariedMax : lender.ageSenpMax;
  if (input.age < ageMin || input.age > ageMax) {
    reasons.push(`Age ${input.age} outside allowed range (${ageMin}–${ageMax})`);
  }

  if (input.tenorServed < lender.minTenorServed) {
    reasons.push(
      `Needs \u2265 ${lender.minTenorServed} months already repaid (has ${input.tenorServed})`
    );
  }

  if (lender.requiresFoirMet === true && !input.foirMet) {
    reasons.push("Requires FOIR to be met");
  }

  if (input.abbMultiple < lender.minABBMultiple) {
    reasons.push(
      `Needs avg. bank balance \u2265 ${lender.minABBMultiple}\u00d7 EMI (has ${input.abbMultiple}\u00d7)`
    );
  }

  if (lender.requiresOwnedResi && input.resi !== "owned") {
    reasons.push("Requires owned residence");
  }

  if (lender.requiresITR && !input.itr) {
    reasons.push("Requires ITR / documented income proof");
  }

  checkLocation(lender, input, reasons);

  const eligible = reasons.length === 0;
  let loanAmount = null;
  let topup = null;

  if (eligible) {
    if (lender.calcBasis === "emi") {
      // EMI-multiplier formula yields the eligible TOP-UP amount directly,
      // not the total loan amount — the closure amount sits on top of it.
      topup = input.currentEMI * input.tenorServed * multiplier;
      loanAmount = input.closureAmount + topup;
    } else {
      // Valuation-based formula yields the TOTAL loan amount directly.
      loanAmount = input.valuation * multiplier;
      topup = loanAmount - input.closureAmount;
    }

    // Total loan cap applies the same way regardless of calc basis.
    if (lender.loanCapping > 0 && loanAmount > lender.loanCapping) {
      loanAmount = lender.loanCapping;
      topup = loanAmount - input.closureAmount;
    }
    // Some lenders cap the top-up itself instead of (or on top of) the total loan.
    if (lender.maxTopupCap > 0) {
      topup = Math.min(topup, lender.maxTopupCap);
    }
    // Some lenders cap the top-up as a multiple of the current EMI.
    if (lender.maxTopupMultipleOfEMI) {
      topup = Math.min(topup, input.currentEMI * lender.maxTopupMultipleOfEMI);
    }
    // Keep loanAmount consistent with whichever cap actually bound the top-up.
    loanAmount = input.closureAmount + topup;
  }

  return {
    lenderId: lender.id,
    lenderName: lender.name,
    logoUrl: lender.logoUrl || null,
    irrRate: lender.irrRate,
    pf: lender.pf,
    notes: lender.notes,
    multiplier,
    eligible,
    reasons,
    loanAmount,
    topup,
  };
}

function normalizeInput(raw) {
  return {
    cibil: Number(raw.cibil) || 0,
    tenorServed: Number(raw.tenorServed) || 0,
    currentEMI: Number(raw.currentEMI) || 0,
    valuation: Number(raw.valuation) || 0,
    closureAmount: Number(raw.closureAmount) || 0,
    owner: Number(raw.owner) || 1,
    age: Number(raw.age) || 0,
    employment: raw.employment === "senp" ? "senp" : "salaried",
    foirMet: raw.foirMet === true || raw.foirMet === "yes",
    abbMultiple: Number(raw.abbMultiple) || 0,
    resi: raw.resi === "rented" ? "rented" : "owned",
    itr: raw.itr === true || raw.itr === "yes",
    location: String(raw.location || "").trim(),
  };
}

function runEligibilityCheck(lenders, rawInput) {
  const input = normalizeInput(rawInput);
  const btLenders = lenders.filter((l) => l.category !== "refinance");
  const evaluated = btLenders.map((l) => evaluateLender(l, input));
  const eligible = evaluated
    .filter((r) => r.eligible)
    .sort((a, b) => b.topup - a.topup || a.irrRate - b.irrRate);
  const ineligible = evaluated.filter((r) => !r.eligible);
  return { input, eligible, ineligible };
}

// ---------------------------------------------------------------------
// Refinance engine — for a fully-owned vehicle with no existing loan to
// close. There's no EMI/closure amount/tenor-served here: the lender
// simply advances a loan against the vehicle's valuation.
// ---------------------------------------------------------------------

function normalizeRefinanceInput(raw) {
  return {
    cibil: Number(raw.cibil) || 0,
    valuation: Number(raw.valuation) || 0,
    owner: Number(raw.owner) || 1,
    age: Number(raw.age) || 0,
    employment: raw.employment === "senp" ? "senp" : "salaried",
    foirMet: raw.foirMet === true || raw.foirMet === "yes",
    abbMultiple: Number(raw.abbMultiple) || 0,
    resi: raw.resi === "rented" ? "rented" : "owned",
    itr: raw.itr === true || raw.itr === "yes",
    location: String(raw.location || "").trim(),
  };
}

function evaluateRefinanceLender(lender, input) {
  const reasons = [];
  // Refinance tiers only carry a flat CIBIL floor (minTenor is always 0),
  // so pass a large dummy tenor so the tenor half of the tier gate never blocks it.
  const multiplier = getMultiplier(lender, input.cibil, 9999);
  if (multiplier === null) {
    reasons.push("CIBIL score below the required minimum");
  }

  if (input.owner < lender.minOwner || input.owner > lender.maxOwner) {
    reasons.push(
      `Owner No. ${input.owner} not accepted (needs owner ${lender.minOwner}${
        lender.maxOwner !== lender.minOwner ? "–" + lender.maxOwner : ""
      })`
    );
  }

  const ageMin = input.employment === "salaried" ? lender.ageSalariedMin : lender.ageSenpMin;
  const ageMax = input.employment === "salaried" ? lender.ageSalariedMax : lender.ageSenpMax;
  if (input.age < ageMin || input.age > ageMax) {
    reasons.push(`Age ${input.age} outside allowed range (${ageMin}–${ageMax})`);
  }

  if (lender.requiresFoirMet === true && !input.foirMet) {
    reasons.push("Requires FOIR to be met");
  }

  if (input.abbMultiple < lender.minABBMultiple) {
    reasons.push(
      `Needs avg. bank balance \u2265 ${lender.minABBMultiple}\u00d7 EMI (has ${input.abbMultiple}\u00d7)`
    );
  }

  if (lender.requiresOwnedResi && input.resi !== "owned") {
    reasons.push("Requires owned residence");
  }

  if (lender.requiresITR && !input.itr) {
    reasons.push("Requires ITR / documented income proof");
  }

  checkLocation(lender, input, reasons);

  const eligible = reasons.length === 0;
  let loanAmount = null;

  if (eligible) {
    const base = input.valuation * multiplier;
    loanAmount = lender.loanCapping > 0 ? Math.min(base, lender.loanCapping) : base;
  }

  return {
    lenderId: lender.id,
    lenderName: lender.name,
    logoUrl: lender.logoUrl || null,
    irrRate: lender.irrRate,
    pf: lender.pf,
    notes: lender.notes,
    multiplier,
    eligible,
    reasons,
    loanAmount,
  };
}

function runRefinanceCheck(lenders, rawInput) {
  const input = normalizeRefinanceInput(rawInput);
  const refiLenders = lenders.filter((l) => l.category === "refinance");
  const evaluated = refiLenders.map((l) => evaluateRefinanceLender(l, input));
  const eligible = evaluated
    .filter((r) => r.eligible)
    .sort((a, b) => b.loanAmount - a.loanAmount || a.irrRate - b.irrRate);
  const ineligible = evaluated.filter((r) => !r.eligible);
  return { input, eligible, ineligible };
}

module.exports = {
  getMultiplier,
  evaluateLender,
  normalizeInput,
  runEligibilityCheck,
  evaluateRefinanceLender,
  normalizeRefinanceInput,
  runRefinanceCheck,
};
