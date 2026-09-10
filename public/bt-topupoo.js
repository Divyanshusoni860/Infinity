// public/app.js
// All eligibility math happens server-side (see /lib/eligibility.js) —
// this file just renders the UI and talks to the JSON API.

let LENDERS = []; // local cache of ALL lenders (both BT and refinance) from the server
const MY_CATEGORY = "bt"; // this page only manages/shows BT top-up lenders
function myLenders() { return LENDERS.filter((l) => (l.category || "bt") === MY_CATEGORY); }

// ---------------- helpers ----------------
function inr(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function logoHTML(l, sizeClass) {
  const cls = "lender-logo" + (sizeClass ? " " + sizeClass : "");
  if (l.logoUrl) {
    return `<div class="${cls}"><img src="${esc(l.logoUrl)}" alt="${esc(l.name)} logo"></div>`;
  }
  const letter = (l.name || "?").trim().charAt(0).toUpperCase() || "?";
  return `<div class="${cls}">${esc(letter)}</div>`;
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
    tenorServed: v("in_tenorServed"),
    currentEMI: v("in_currentEMI"),
    valuation: v("in_valuation"),
    closureAmount: v("in_closureAmount"),
    owner: v("in_owner"),
    age: v("in_age"),
    employment: v("in_employment"),
    foirMet: v("in_foirMet"),
    abbMultiple: v("in_abbMultiple"),
    resi: v("in_resi"),
    itr: v("in_itr"),
    location: v("in_location"),
  };

  showStatus("calcStatus", "");
  try {
    const { eligible, ineligible } = await api("/api/check", {
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
          <div class="lender-name-row">
            ${logoHTML({ name: r.lenderName, logoUrl: r.logoUrl }, "sm")}
            <div>
              <p class="rc-name">${esc(r.lenderName)}</p>
              <div class="rc-meta">${r.multiplier}× multiplier · ${r.irrRate}% IRR · ${r.pf}% PF</div>
            </div>
          </div>
          <div class="rc-icon-ok">✓</div>
        </div>
        <div class="rc-stats">
          <div class="rc-stat"><div class="l">Loan amount</div><div class="v">${inr(r.loanAmount)}</div></div>
          <div class="rc-stat"><div class="l">Top-up (cash out)</div><div class="v green">${inr(r.topup)}</div></div>
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

function buildTiersHTML(lender) {
  return lender.tiers.map((t) => `
    <div class="tier-row" data-tier-id="${t.id}">
      <div class="field"><label>Min CIBIL</label><input type="number" value="${t.minCibil}" oninput="onTierInput('${lender.id}','${t.id}','minCibil',this.value)"></div>
      <div class="field"><label>Min tenor served</label><input type="number" value="${t.minTenor}" oninput="onTierInput('${lender.id}','${t.id}','minTenor',this.value)"></div>
      <div class="field"><label>Multiplier</label><input type="number" step="0.01" value="${t.multiplier}" oninput="onTierInput('${lender.id}','${t.id}','multiplier',this.value)"></div>
      <button class="tier-remove" onclick="removeTier('${lender.id}','${t.id}')">✕</button>
    </div>
  `).join("");
}

function lenderCardHTML(l) {
  return `
  <div class="lender-row" id="lender_${l.id}">
    <button class="lender-head" onclick="toggleLender('${l.id}')">
      <div class="lender-name-row">
        <span id="logowrap_${l.id}">${logoHTML(l, "sm")}</span>
        <div>
          <div class="ln">${esc(l.name)}</div>
          <div class="lm" id="lendermeta_${l.id}">${l.calcBasis === "emi" ? "EMI-based" : "Valuation-based"} · ${l.tiers.length} tier${l.tiers.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <div class="chev">▾</div>
    </button>
    <div class="lender-edit">
      <div class="logo-upload-row">
        <span id="logopreview_${l.id}">${logoHTML(l, "lg")}</span>
        <div class="logo-upload-actions">
          <input type="file" accept="image/*" id="logofile_${l.id}" style="display:none;" onchange="onLogoFile('${l.id}',this)">
          <button class="logo-upload-btn" onclick="document.getElementById('logofile_${l.id}').click()">📷 Upload logo</button>
          ${l.logoUrl ? `<button class="logo-remove-btn" onclick="removeLogo('${l.id}')">Remove logo</button>` : ""}
        </div>
      </div>
      <div class="field" style="margin-bottom:10px;">
        <label>Lender name</label>
        <input type="text" value="${esc(l.name)}" oninput="onLenderField('${l.id}','name',this.value,'text')">
      </div>
      <div class="field" style="margin-bottom:12px;">
        <label>Loan basis</label>
        <select onchange="onLenderField('${l.id}','calcBasis',this.value,'text')">
          <option value="emi" ${l.calcBasis === "emi" ? "selected" : ""}>EMI × tenor served</option>
          <option value="valuation" ${l.calcBasis === "valuation" ? "selected" : ""}>Vehicle valuation</option>
        </select>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:600;color:var(--muted);">Multiplier tiers</span>
        <button class="small-btn" onclick="addTier('${l.id}')">+ Add tier</button>
      </div>
      <div id="tiers_${l.id}">${buildTiersHTML(l)}</div>

      <div class="grid2" style="margin-top:10px;">
        <div class="field"><label>Min owner</label><input type="number" value="${l.minOwner}" oninput="onLenderField('${l.id}','minOwner',this.value,'num')"></div>
        <div class="field"><label>Max owner</label><input type="number" value="${l.maxOwner}" oninput="onLenderField('${l.id}','maxOwner',this.value,'num')"></div>
        <div class="field"><label>Age min (salaried)</label><input type="number" value="${l.ageSalariedMin}" oninput="onLenderField('${l.id}','ageSalariedMin',this.value,'num')"></div>
        <div class="field"><label>Age max (salaried)</label><input type="number" value="${l.ageSalariedMax}" oninput="onLenderField('${l.id}','ageSalariedMax',this.value,'num')"></div>
        <div class="field"><label>Age min (self-emp.)</label><input type="number" value="${l.ageSenpMin}" oninput="onLenderField('${l.id}','ageSenpMin',this.value,'num')"></div>
        <div class="field"><label>Age max (self-emp.)</label><input type="number" value="${l.ageSenpMax}" oninput="onLenderField('${l.id}','ageSenpMax',this.value,'num')"></div>
        <div class="field"><label>Min tenor served (EOT)</label><input type="number" value="${l.minTenorServed}" oninput="onLenderField('${l.id}','minTenorServed',this.value,'num')"></div>
        <div class="field"><label>Loan capping (₹, 0=none)</label><input type="number" value="${l.loanCapping}" oninput="onLenderField('${l.id}','loanCapping',this.value,'num')"></div>
        <div class="field"><label>Max top-up cap (₹, 0=none)</label><input type="number" value="${l.maxTopupCap || 0}" oninput="onLenderField('${l.id}','maxTopupCap',this.value,'num')"><span class="hint">Caps the top-up itself, on top of any loan capping above</span></div>
        <div class="field"><label>Max top-up (× current EMI, 0=none)</label><input type="number" step="0.1" value="${l.maxTopupMultipleOfEMI || 0}" oninput="onLenderField('${l.id}','maxTopupMultipleOfEMI',this.value,'numOrNull')"></div>
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

      <div class="section-sub" style="margin-top:14px;">Location coverage</div>
      <div class="field">
        <label>Serviceable locations (comma-separated)</label>
        <input type="text" value="${esc((l.serviceableLocations || []).join(", "))}" placeholder="Blank = serves everywhere" oninput="onLocationsInput('${l.id}',this.value)">
        <span class="hint">If set, applicants outside these locations will show as ineligible for this lender</span>
      </div>

      <button class="delete-lender" onclick="removeLender('${l.id}')">🗑 Delete lender</button>
    </div>
  </div>`;
}

function onLocationsInput(id, rawVal) {
  const l = findLender(id);
  if (!l) return;
  l.serviceableLocations = rawVal.split(",").map((s) => s.trim()).filter(Boolean);
  scheduleSave(id);
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

// debounce so we don't fire a PUT on every single keystroke
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
  else if (kind === "numOrNull") val = Number(rawVal) > 0 ? Number(rawVal) : null;
  else if (kind === "bool") val = !!rawVal;
  else if (kind === "tri") val = rawVal === "na" ? null : rawVal === "yes";
  l[field] = val;

  if (field === "name" || field === "calcBasis") {
    const metaEl = document.getElementById("lendermeta_" + id);
    if (metaEl) metaEl.textContent = `${l.calcBasis === "emi" ? "EMI-based" : "Valuation-based"} · ${l.tiers.length} tier${l.tiers.length !== 1 ? "s" : ""}`;
    if (field === "name") {
      const headEl = document.querySelector("#lender_" + id + " .ln");
      if (headEl) headEl.textContent = l.name;
      if (!l.logoUrl) {
        const wrap = document.getElementById("logowrap_" + id);
        if (wrap) wrap.innerHTML = logoHTML(l, "sm");
        const preview = document.getElementById("logopreview_" + id);
        if (preview) preview.innerHTML = logoHTML(l, "lg");
      }
    }
  }
  scheduleSave(id);
}

function onLogoFile(id, input) {
  const l = findLender(id);
  const file = input.files && input.files[0];
  if (!l || !file) return;
  if (file.size > 800 * 1024) {
    showStatus("lendersStatus", "Logo is too large — please use an image under 800KB.", "error");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    l.logoUrl = reader.result;
    const wrap = document.getElementById("logowrap_" + id);
    if (wrap) wrap.innerHTML = logoHTML(l, "sm");
    const preview = document.getElementById("logopreview_" + id);
    if (preview) preview.innerHTML = logoHTML(l, "lg");
    // re-render so the "Remove logo" link appears
    const row = document.getElementById("lender_" + id);
    const wasOpen = row && row.classList.contains("open");
    row.outerHTML = lenderCardHTML(l);
    if (wasOpen) document.getElementById("lender_" + id).classList.add("open");
    scheduleSave(id);
  };
  reader.readAsDataURL(file);
}

function removeLogo(id) {
  const l = findLender(id);
  if (!l) return;
  l.logoUrl = "";
  const row = document.getElementById("lender_" + id);
  const wasOpen = row && row.classList.contains("open");
  row.outerHTML = lenderCardHTML(l);
  if (wasOpen) document.getElementById("lender_" + id).classList.add("open");
  scheduleSave(id);
}

function onTierInput(lenderId, tierId, field, rawVal) {
  const l = findLender(lenderId);
  if (!l) return;
  const t = l.tiers.find((t) => t.id === tierId);
  if (!t) return;
  t[field] = Number(rawVal) || 0;
  scheduleSave(lenderId);
}

function addTier(lenderId) {
  const l = findLender(lenderId);
  if (!l) return;
  l.tiers.push({ id: "t" + Date.now().toString(36), minCibil: 700, minTenor: 0, multiplier: 1.0 });
  document.getElementById("tiers_" + lenderId).innerHTML = buildTiersHTML(l);
  updateMeta(l);
  scheduleSave(lenderId);
}

function removeTier(lenderId, tierId) {
  const l = findLender(lenderId);
  if (!l) return;
  l.tiers = l.tiers.filter((t) => t.id !== tierId);
  document.getElementById("tiers_" + lenderId).innerHTML = buildTiersHTML(l);
  updateMeta(l);
  scheduleSave(lenderId);
}

function updateMeta(l) {
  const metaEl = document.getElementById("lendermeta_" + l.id);
  if (metaEl) metaEl.textContent = `${l.calcBasis === "emi" ? "EMI-based" : "Valuation-based"} · ${l.tiers.length} tier${l.tiers.length !== 1 ? "s" : ""}`;
}

async function addLender() {
  showStatus("lendersStatus", "");
  try {
    const l = await api("/api/lenders", { method: "POST", body: JSON.stringify({ name: "New Lender", category: MY_CATEGORY }) });
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
    renderHistory(history.filter((h) => (h.type || "bt") === MY_CATEGORY));
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
        <div class="hi-main">${ok ? `Best: <b>${esc(h.bestLender)}</b> — ${inr(h.bestTopup)} top-up` : "No lender matched"}</div>
        <div class="hi-time">${esc(time)} · CIBIL ${h.input.cibil} · Tenor ${h.input.tenorServed}mo</div>
      </div>
      <div class="hi-badge ${ok ? "ok" : "none"}">${h.eligibleCount} eligible</div>
    </div>`;
  }).join("");
}

async function clearHistory() {
  if (!confirm("Clear all check history?")) return;
  try {
    await api("/api/history", { method: "DELETE" });
    loadHistory();
  } catch (err) {
    alert("Couldn't clear history: " + err.message);
  }
}

// ---------------- applicant prefill ----------------
const APPLICANT_ID = new URLSearchParams(location.search).get("applicantId");

async function loadApplicantPrefill() {
  const bannerEl = document.getElementById("applicantBanner");
  if (!APPLICANT_ID) return;
  try {
    const a = await api("/api/applicants/" + encodeURIComponent(APPLICANT_ID));
    const set = (id, val) => { if (val !== null && val !== undefined && val !== "") document.getElementById(id).value = val; };
    set("in_cibil", a.cibil);
    set("in_age", a.age);
    set("in_employment", a.employment);
    set("in_foirMet", a.foirMet === false ? "no" : "yes");
    set("in_abbMultiple", a.abbMultiple);
    set("in_resi", a.resi);
    set("in_itr", a.itr ? "yes" : "no");
    set("in_location", a.location);
    bannerEl.innerHTML = `<div class="applicant-banner">
      <div class="ab-main">Prefilled from applicant: <b>${esc(a.name || "Unnamed")}</b> · PAN ${esc(a.pan || "—")}</div>
      <a href="/check?applicantId=${encodeURIComponent(a.id)}">← Back to product picker</a>
    </div>`;
  } catch (err) {
    bannerEl.innerHTML = `<div class="status-banner error">Couldn't load applicant: ${esc(err.message)}</div>`;
  }
}

// ---------------- init ----------------
loadLenders();
loadApplicantPrefill();
