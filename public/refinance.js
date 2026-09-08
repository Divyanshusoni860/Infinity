// public/refinance.js
// Mirrors bt-topup.js, but for the refinance flow: no existing loan, no
// EMI/closure amount/tenor-served — just valuation x multiplier.

let LENDERS = []; // local cache of ALL lenders (both BT and refinance) from the server
const MY_CATEGORY = "refinance";
function myLenders() { return LENDERS.filter((l) => l.category === MY_CATEGORY); }

// ---------------- helpers ----------------
function inr(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || msg; } catch (e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}
function showStatus(containerId, message, kind) {
  const el = document.getElementById(containerId);
  if (!message) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="status-banner ${kind || "info"}">${esc(message)}</div>`;
}

// ---------------- tabs ----------------
function switchTab(tab) {
  document.getElementById("panelCalc").classList.toggle("active", tab === "calc");
  document.getElementById("panelLenders").classList.toggle("active", tab === "lenders");
  document.getElementById("panelHistory").classList.toggle("active", tab === "history");
  document.getElementById("tabBtnCalc").classList.toggle("active", tab === "calc");
  document.getElementById("tabBtnLenders").classList.toggle("active", tab === "lenders");
  document.getElementById("tabBtnHistory").classList.toggle("active", tab === "history");
  if (tab === "lenders" && LENDERS.length === 0) loadLenders();
  if (tab === "history") loadHistory();
}

// ---------------- eligibility check ----------------
async function runCheck() {
  const v = (id) => document.getElementById(id).value;
  const input = {
    cibil: v("in_cibil"),
    valuation: v("in_valuation"),
    owner: v("in_owner"),
    age: v("in_age"),
    employment: v("in_employment"),
    foirMet: v("in_foirMet"),
    abbMultiple: v("in_abbMultiple"),
    resi: v("in_resi"),
    itr: v("in_itr"),
  };

  showStatus("calcStatus", "");
  try {
    const { eligible, ineligible } = await api("/api/check-refinance", {
      method: "POST",
      body: JSON.stringify(input),
    });
    renderResults(eligible, ineligible);
  } catch (err) {
    showStatus("calcStatus", "Couldn't reach the server: " + err.message, "error");
  }
}

function renderResults(eligible, ineligible) {
  const c = document.getElementById("resultsContainer");
  let html = `<div class="section-title">Eligible lenders (${eligible.length})</div>`;

  if (eligible.length === 0) {
    const freq = {};
    ineligible.forEach((r) => r.reasons.forEach((reason) => { freq[reason] = (freq[reason] || 0) + 1; }));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4);
    html += `<div class="blocker-summary">
      <div class="t">No lender matched — most common blockers</div>
      ${top.map(([reason, count]) => `<div class="row"><span>${esc(reason)}</span><span>${count}/${ineligible.length}</span></div>`).join("")}
    </div>`;
    html += `<div class="empty-state">Adjust the inputs above (especially any blocker listed) and check again.</div>`;
  } else {
    eligible.forEach((r, i) => {
      html += `<div class="result-card ${i === 0 ? "best" : ""}">
        ${i === 0 ? '<div class="badge-best">★ Best offer</div>' : ""}
        <div class="rc-top">
          <div>
            <p class="rc-name">${esc(r.lenderName)}</p>
            <div class="rc-meta">${r.multiplier}× of valuation · ${r.irrRate}% IRR · ${r.pf}% PF</div>
          </div>
          <div class="rc-icon-ok">✓</div>
        </div>
        <div class="rc-stats" style="grid-template-columns:1fr;">
          <div class="rc-stat"><div class="l">Loan amount</div><div class="v green">${inr(r.loanAmount)}</div></div>
        </div>
        ${r.notes ? `<div class="rc-note">${esc(r.notes)}</div>` : ""}
      </div>`;
    });
  }

  html += `<button class="ineligible-toggle" onclick="toggleIneligible()">
      <span>Not eligible (${ineligible.length})</span><span id="ineligChev">▾</span>
    </button>
    <div class="ineligible-list ${eligible.length === 0 ? "open" : ""}" id="ineligibleList">
      ${ineligible.map((r) => `
        <div class="ineligible-card">
          <div class="name">✕ ${esc(r.lenderName)}</div>
          <ul class="reasons">${r.reasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul>
        </div>
      `).join("")}
    </div>`;

  c.innerHTML = html;
}

function toggleIneligible() {
  document.getElementById("ineligibleList").classList.toggle("open");
}

// ---------------- lenders tab ----------------
async function loadLenders() {
  showStatus("lendersStatus", "");
  try {
    LENDERS = await api("/api/lenders");
    renderLendersList();
  } catch (err) {
    showStatus("lendersStatus", "Couldn't load lenders: " + err.message, "error");
  }
}

function lenderCardHTML(l) {
  const mult = l.tiers[0] ? l.tiers[0].multiplier : 0;
  const minCibil = l.tiers[0] ? l.tiers[0].minCibil : 700;
  return `
  <div class="lender-row" id="lender_${l.id}">
    <button class="lender-head" onclick="toggleLender('${l.id}')">
      <div>
        <div class="ln">${esc(l.name)}</div>
        <div class="lm" id="lendermeta_${l.id}">${mult}× of valuation · min CIBIL ${minCibil}</div>
      </div>
      <div class="chev">▾</div>
    </button>
    <div class="lender-edit">
      <div class="field" style="margin-bottom:10px;">
        <label>Lender name</label>
        <input type="text" value="${esc(l.name)}" oninput="onLenderField('${l.id}','name',this.value,'text')">
      </div>

      <div class="grid2" style="margin-bottom:10px;">
        <div class="field"><label>Min CIBIL</label><input type="number" value="${minCibil}" oninput="onTierInput('${l.id}','minCibil',this.value)"></div>
        <div class="field"><label>Multiplier (× valuation)</label><input type="number" step="0.01" value="${mult}" oninput="onTierInput('${l.id}','multiplier',this.value)"></div>
      </div>

      <div class="grid2">
        <div class="field"><label>Min owner</label><input type="number" value="${l.minOwner}" oninput="onLenderField('${l.id}','minOwner',this.value,'num')"></div>
        <div class="field"><label>Max owner</label><input type="number" value="${l.maxOwner}" oninput="onLenderField('${l.id}','maxOwner',this.value,'num')"></div>
        <div class="field"><label>Age min (salaried)</label><input type="number" value="${l.ageSalariedMin}" oninput="onLenderField('${l.id}','ageSalariedMin',this.value,'num')"></div>
        <div class="field"><label>Age max (salaried)</label><input type="number" value="${l.ageSalariedMax}" oninput="onLenderField('${l.id}','ageSalariedMax',this.value,'num')"></div>
        <div class="field"><label>Age min (self-emp.)</label><input type="number" value="${l.ageSenpMin}" oninput="onLenderField('${l.id}','ageSenpMin',this.value,'num')"></div>
        <div class="field"><label>Age max (self-emp.)</label><input type="number" value="${l.ageSenpMax}" oninput="onLenderField('${l.id}','ageSenpMax',this.value,'num')"></div>
        <div class="field"><label>Loan capping (₹, 0=none)</label><input type="number" value="${l.loanCapping}" oninput="onLenderField('${l.id}','loanCapping',this.value,'num')"></div>
        <div class="field"><label>Min ABB (× EMI)</label><input type="number" step="0.1" value="${l.minABBMultiple}" oninput="onLenderField('${l.id}','minABBMultiple',this.value,'num')"></div>
        <div class="field"><label>FOIR requirement</label>
          <select onchange="onLenderField('${l.id}','requiresFoirMet',this.value,'tri')">
            <option value="na" ${l.requiresFoirMet === null ? "selected" : ""}>Not required</option>
            <option value="yes" ${l.requiresFoirMet === true ? "selected" : ""}>Must be met</option>
          </select>
        </div>
        <div class="field"><label>IRR (%)</label><input type="number" step="0.01" value="${l.irrRate}" oninput="onLenderField('${l.id}','irrRate',this.value,'num')"></div>
        <div class="field"><label>Processing fee (%)</label><input type="number" step="0.1" value="${l.pf}" oninput="onLenderField('${l.id}','pf',this.value,'num')"></div>
      </div>

      <div class="check-row">
        <label><input type="checkbox" ${l.requiresOwnedResi ? "checked" : ""} onchange="onLenderField('${l.id}','requiresOwnedResi',this.checked,'bool')"> Requires owned residence</label>
        <label><input type="checkbox" ${l.requiresITR ? "checked" : ""} onchange="onLenderField('${l.id}','requiresITR',this.checked,'bool')"> Requires ITR</label>
      </div>

      <div class="field" style="margin-top:8px;">
        <label>Notes</label>
        <input type="text" value="${esc(l.notes || "")}" oninput="onLenderField('${l.id}','notes',this.value,'text')">
      </div>

      <button class="delete-lender" onclick="removeLender('${l.id}')">🗑 Delete lender</button>
    </div>
  </div>`;
}

function renderLendersList() {
  const mine = myLenders();
  document.getElementById("lendersList").innerHTML = mine.map(lenderCardHTML).join("");
  document.getElementById("lenderCount").textContent = mine.length;
}

function findLender(id) { return LENDERS.find((l) => l.id === id); }

function toggleLender(id) {
  document.getElementById("lender_" + id).classList.toggle("open");
}

const pendingSaves = {};
function scheduleSave(id) {
  clearTimeout(pendingSaves[id]);
  pendingSaves[id] = setTimeout(() => saveLender(id), 400);
}
async function saveLender(id) {
  const l = findLender(id);
  if (!l) return;
  try {
    await api("/api/lenders/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(l) });
  } catch (err) {
    showStatus("lendersStatus", "Couldn't save changes: " + err.message, "error");
  }
}

function onLenderField(id, field, rawVal, kind) {
  const l = findLender(id);
  if (!l) return;
  let val = rawVal;
  if (kind === "num") val = Number(rawVal) || 0;
  else if (kind === "bool") val = !!rawVal;
  else if (kind === "tri") val = rawVal === "na" ? null : rawVal === "yes";
  l[field] = val;

  if (field === "name") {
    const headEl = document.querySelector("#lender_" + id + " .ln");
    if (headEl) headEl.textContent = l.name;
  }
  scheduleSave(id);
}

// Refinance lenders only ever have a single tier (flat multiplier of valuation).
function onTierInput(lenderId, field, rawVal) {
  const l = findLender(lenderId);
  if (!l) return;
  if (!l.tiers[0]) l.tiers[0] = { id: "t1", minCibil: 700, minTenor: 0, multiplier: 1 };
  l.tiers[0][field] = Number(rawVal) || 0;
  const metaEl = document.getElementById("lendermeta_" + lenderId);
  if (metaEl) metaEl.textContent = `${l.tiers[0].multiplier}× of valuation · min CIBIL ${l.tiers[0].minCibil}`;
  scheduleSave(lenderId);
}

async function addLender() {
  showStatus("lendersStatus", "");
  try {
    const l = await api("/api/lenders", {
      method: "POST",
      body: JSON.stringify({
        name: "New Refinance Lender",
        category: MY_CATEGORY,
        calcBasis: "valuation",
        tiers: [{ id: "t1", minCibil: 700, minTenor: 0, multiplier: 1.0 }],
        minTenorServed: 0,
      }),
    });
    LENDERS.push(l);
    document.getElementById("lendersList").insertAdjacentHTML("beforeend", lenderCardHTML(l));
    document.getElementById("lenderCount").textContent = myLenders().length;
    const row = document.getElementById("lender_" + l.id);
    row.classList.add("open");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    showStatus("lendersStatus", "Couldn't add lender: " + err.message, "error");
  }
}

async function removeLender(id) {
  try {
    await api("/api/lenders/" + encodeURIComponent(id), { method: "DELETE" });
    LENDERS = LENDERS.filter((l) => l.id !== id);
    const el = document.getElementById("lender_" + id);
    if (el) el.remove();
    document.getElementById("lenderCount").textContent = myLenders().length;
  } catch (err) {
    showStatus("lendersStatus", "Couldn't delete lender: " + err.message, "error");
  }
}

async function resetLenders() {
  if (!confirm("Reset all lenders (BT and refinance) back to the original defaults? Your edits will be lost.")) return;
  try {
    LENDERS = await api("/api/lenders-reset", { method: "POST" });
    renderLendersList();
  } catch (err) {
    showStatus("lendersStatus", "Couldn't reset: " + err.message, "error");
  }
}

// ---------------- history tab ----------------
async function loadHistory() {
  try {
    const history = await api("/api/history");
    renderHistory(history.filter((h) => h.type === MY_CATEGORY));
  } catch (err) {
    document.getElementById("historyList").innerHTML = `<div class="status-banner error">Couldn't load history: ${esc(err.message)}</div>`;
  }
}

function renderHistory(history) {
  const el = document.getElementById("historyList");
  if (history.length === 0) {
    el.innerHTML = `<div class="empty-state">No checks run yet — results you check will show up here.</div>`;
    return;
  }
  el.innerHTML = history.map((h) => {
    const time = new Date(h.timestamp).toLocaleString();
    const ok = h.eligibleCount > 0;
    return `<div class="history-item">
      <div>
        <div class="hi-main">${ok ? `Best: <b>${esc(h.bestLender)}</b> — ${inr(h.bestLoanAmount)} loan` : "No lender matched"}</div>
        <div class="hi-time">${esc(time)} · CIBIL ${h.input.cibil} · Valuation ${inr(h.input.valuation)}</div>
      </div>
      <div class="hi-badge ${ok ? "ok" : "none"}">${h.eligibleCount} eligible</div>
    </div>`;
  }).join("");
}

async function clearHistory() {
  if (!confirm("Clear all check history (both BT and refinance)?")) return;
  try {
    await api("/api/history", { method: "DELETE" });
    loadHistory();
  } catch (err) {
    alert("Couldn't clear history: " + err.message);
  }
}

// ---------------- init ----------------
loadLenders();
