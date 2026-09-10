// public/home.js
// Home dashboard. Tab 1 ("Applicant Info") captures the applicant's
// details once and saves them via the existing /api/applicants CRUD.
// The remaining tabs are the product list (unchanged behaviour) — the
// only difference is their "Open" links now carry the saved
// applicant's id forward, so bt-topup.js / refinance.js can skip
// fields that are already known instead of asking again.

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
async function api(path, opts) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || msg; } catch (e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}
function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------------- current applicant (persists across visits) ----------------
const STORAGE_KEY = "finqy_applicant_id";
function getStoredApplicantId() { return localStorage.getItem(STORAGE_KEY) || null; }
function setStoredApplicantId(id) {
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
}

let CURRENT_APPLICANT = null; // full applicant object once loaded, else null

// A ?applicantId= in the URL (e.g. coming from /applicants) wins and is remembered.
const urlApplicantId = new URLSearchParams(location.search).get("applicantId");
if (urlApplicantId) setStoredApplicantId(urlApplicantId);

// ---------------- tab list ----------------
const TOOLS = [
  {
    id: "applicant", icon: "📋", name: "Applicant Info", badge: "start", href: null,
    desc: "Enter the applicant's details once — every product below reuses it automatically.",
  },
  {
    id: "bt-topup", icon: "🚗", name: "Car Loan BT Top-Up", badge: "ready", href: "/bt-topup",
    desc: "Check balance-transfer + top-up eligibility across 16 lenders for an existing car loan, ranked by best offer.",
  },
  {
    id: "refinance", icon: "🔁", name: "Car Refinance", badge: "ready", href: "/refinance",
    desc: "For a fully-owned vehicle with no existing loan — check refinance eligibility against 5 lenders, ranked by best loan amount.",
  },
  {
    id: "emi-calculator", icon: "🧮", name: "EMI Calculator", badge: "ready", href: "/emi-calculator",
    desc: "Work out monthly EMI, total interest, and total payout for any loan amount and tenure.",
  },
  {
    id: "home-loan", icon: "🏠", name: "Home Loan BT Top-Up", badge: "soon", href: null,
    desc: "Same idea as the car loan tool, tuned for home loan balance transfer policies. Not activated yet.",
  },
  {
    id: "personal-loan", icon: "💳", name: "Personal Loan Eligibility", badge: "soon", href: null,
    desc: "Compare personal loan offers across lenders based on income and credit profile. Not activated yet.",
  },
  {
    id: "business-loan", icon: "🏢", name: "Business Loan Eligibility", badge: "soon", href: null,
    desc: "Eligibility and offer comparison for business / working-capital loans. Not activated yet.",
  },
  {
    id: "lap", icon: "📄", name: "Loan Against Property", badge: "soon", href: null,
    desc: "LAP eligibility and top-up comparison across lender policies. Not activated yet.",
  },
];

let activeTool = "applicant";

function badgeLabel(badge) {
  if (badge === "start") return "Start here";
  return badge === "ready" ? "Ready" : "Coming soon";
}

// Carries the saved applicant id forward so the product page can prefill / skip fields.
function toolHref(t) {
  if (!t.href) return null;
  const id = getStoredApplicantId();
  return id ? `${t.href}?applicantId=${encodeURIComponent(id)}` : t.href;
}

function renderTabs() {
  const nav = document.getElementById("vtabsNav");
  nav.innerHTML = TOOLS.map((t) => `
    <button class="vtab-btn ${t.id === activeTool ? "active" : ""}" onclick="selectTool('${t.id}')">
      <span class="vt-icon">${t.icon}</span>
      <span class="vt-name">${t.name}</span>
      <span class="vt-badge ${t.badge}">${badgeLabel(t.badge)}</span>
    </button>
  `).join("");
  renderPanel();
}

function renderPanel() {
  const t = TOOLS.find((x) => x.id === activeTool);
  const panel = document.getElementById("vtabsPanel");
  if (!t) { panel.innerHTML = ""; return; }

  if (t.id === "applicant") {
    panel.innerHTML = applicantFormHTML();
    fillApplicantForm(CURRENT_APPLICANT);
    return;
  }

  const href = toolHref(t);
  const note = !t.href
    ? ""
    : CURRENT_APPLICANT
      ? `<div class="status-banner info">Using saved info for <b>${esc(CURRENT_APPLICANT.name || "this applicant")}</b> — you'll only be asked for the extra, product-specific details.</div>`
      : `<div class="status-banner info">Tip: fill in <b>Applicant Info</b> first (tab on the left) so you don't have to re-enter details on every product.</div>`;

  panel.innerHTML = `
    <div class="vp-icon">${t.icon}</div>
    <h3>${t.name}</h3>
    <p>${t.desc}</p>
    ${note}
    ${href
      ? `<a class="btn-primary hero-btn" href="${href}">Open ${t.name} →</a>`
      : `<button class="btn-primary hero-btn" disabled style="opacity:0.5;cursor:not-allowed;">Coming soon</button>`}
  `;
}

function selectTool(id) {
  activeTool = id;
  renderTabs();
}

// ---------------- applicant info tab ----------------
function applicantFormHTML() {
  const editing = !!CURRENT_APPLICANT;
  return `
    <div class="applicant-info-head">
      <div>
        <h3 style="margin:0 0 4px;">${editing ? "Editing applicant" : "New applicant"}</h3>
        <p style="margin:0;">${editing ? "Saved once, reused by every product below." : "Fill this in once — every product below will reuse it."}</p>
      </div>
      ${editing ? `<button class="fetch-btn" style="padding:8px 12px;border-style:solid;" onclick="startNewApplicant()">+ New applicant</button>` : ""}
    </div>
    <div id="applicantFormStatus"></div>

    <div class="section-sub" style="margin-top:6px;">Contact</div>
    <div class="grid2">
      <div class="field"><label>Full name</label><input type="text" id="f_name" placeholder="e.g. Rohit Sharma"></div>
      <div class="field"><label>Phone</label><input type="text" id="f_phone" placeholder="10-digit mobile"></div>
      <div class="field"><label>Email</label><input type="text" id="f_email" placeholder="optional"></div>
      <div class="field"><label>Location (city / state)</label><input type="text" id="f_location" placeholder="e.g. Indore, MP"><span class="hint">Used to match lenders that cover this location</span></div>
    </div>

    <div class="section-sub">Credit profile</div>
    <div class="grid2">
      <div class="field"><label>PAN</label><input type="text" id="f_pan" placeholder="ABCDE1234F" style="text-transform:uppercase;"></div>
      <div class="field">
        <label>CIBIL score</label>
        <div class="fetch-row">
          <input type="number" id="f_cibil" placeholder="e.g. 730">
          <button type="button" class="fetch-btn" onclick="fetchCibilDummy()">🔍 Fetch via PAN</button>
        </div>
        <span class="hint">Bureau API not connected yet — fetch button is a placeholder for later integration</span>
      </div>
    </div>

    <div class="section-sub">Employment</div>
    <div class="grid2">
      <div class="field"><label>Employment type</label>
        <select id="f_employment"><option value="salaried">Salaried</option><option value="senp">Self-employed</option></select>
      </div>
      <div class="field"><label>Age</label><input type="number" id="f_age" placeholder="e.g. 38"></div>
    </div>

    <div class="section-sub">ITR &amp; business</div>
    <div class="check-row" style="margin-top:0;">
      <label><input type="checkbox" id="f_itr" onchange="toggleBusinessFields()"> ITR filed / available</label>
      <label><input type="checkbox" id="f_businessOwner" onchange="toggleBusinessFields()"> Runs own business</label>
    </div>
    <div class="grid2" id="businessFields" style="display:none;margin-top:10px;">
      <div class="field"><label>Business running for (years)</label><input type="number" step="0.5" id="f_businessVintage" placeholder="e.g. 4"></div>
      <div class="field"><label>GST registered?</label>
        <select id="f_gstRegistered"><option value="no">No</option><option value="yes">Yes</option></select>
      </div>
      <div class="field" style="grid-column:1 / -1;"><label>GST / business name</label><input type="text" id="f_gstName" placeholder="Registered business name"></div>
    </div>

    <div class="section-sub">Obligations &amp; banking</div>
    <div class="grid2">
      <div class="field"><label>FOIR met?</label>
        <select id="f_foirMet"><option value="yes">Yes</option><option value="no">No</option></select>
      </div>
      <div class="field"><label>FOIR / obligation (%)</label><input type="number" step="0.1" id="f_foirPercent" placeholder="e.g. 45"><span class="hint">Recorded for reference — the Yes/No above drives eligibility today</span></div>
      <div class="field"><label>Avg. bank balance (× EMI)</label><input type="number" step="0.1" id="f_abbMultiple" placeholder="e.g. 1.5"><span class="hint">Used directly by BT top-up / refinance checks</span></div>
      <div class="field"><label>Avg. bank balance (₹, informational)</label><input type="number" id="f_abbAmount" placeholder="e.g. 65000"></div>
    </div>
    <div class="upload-disabled" style="margin-top:4px;">
      <span class="badge-soon">Coming soon</span>
      <span>Upload a bank statement PDF to auto-extract the 5th/15th/25th balances</span>
      <button type="button" class="fetch-btn" style="margin-left:auto;" onclick="fetchAbbDummy()">🔄 Auto-fetch ABB</button>
    </div>

    <div class="section-sub">Ownership</div>
    <div class="field">
      <label>Residence</label>
      <select id="f_resi"><option value="owned">Owned</option><option value="rented">Rented</option></select>
      <span class="hint">Reused across car loan, refinance, and future products</span>
    </div>

    <button class="btn-primary" onclick="saveApplicant()" id="saveApplicantBtn" style="margin-top:18px;">${editing ? "Save changes" : "Save applicant info"}</button>
  `;
}

function toggleBusinessFields() {
  const show = document.getElementById("f_itr").checked || document.getElementById("f_businessOwner").checked;
  document.getElementById("businessFields").style.display = show ? "grid" : "none";
}

function fillApplicantForm(a) {
  a = a || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set("f_name", a.name || "");
  set("f_phone", a.phone || "");
  set("f_email", a.email || "");
  set("f_location", a.location || "");
  set("f_pan", a.pan || "");
  set("f_cibil", a.cibil ?? "");
  set("f_employment", a.employment || "salaried");
  set("f_age", a.age ?? "");
  const itrEl = document.getElementById("f_itr");
  const bizEl = document.getElementById("f_businessOwner");
  if (itrEl) itrEl.checked = !!a.itr;
  if (bizEl) bizEl.checked = !!a.businessOwner;
  set("f_businessVintage", a.businessVintageYears ?? "");
  set("f_gstRegistered", a.gstRegistered ? "yes" : "no");
  set("f_gstName", a.gstBusinessName || "");
  set("f_foirMet", a.foirMet === false ? "no" : "yes");
  set("f_foirPercent", a.foirPercent ?? "");
  set("f_abbMultiple", a.abbMultiple ?? "");
  set("f_abbAmount", a.averageBankBalanceAmount ?? "");
  set("f_resi", a.resi || "owned");
  toggleBusinessFields();
}

// Dummy placeholders — no bureau / bank-statement API wired up yet.
function fetchCibilDummy() {
  showToast("Bureau API not connected yet — enter the CIBIL score manually for now.");
}
function fetchAbbDummy() {
  showToast("Bank statement auto-read not connected yet — enter ABB manually for now.");
}

function collectApplicantPayload() {
  const v = (id) => document.getElementById(id).value;
  return {
    name: v("f_name").trim(),
    phone: v("f_phone").trim(),
    email: v("f_email").trim(),
    location: v("f_location").trim(),
    pan: v("f_pan").trim().toUpperCase(),
    cibil: v("f_cibil") ? Number(v("f_cibil")) : null,
    employment: v("f_employment"),
    age: v("f_age") ? Number(v("f_age")) : null,
    itr: document.getElementById("f_itr").checked,
    businessOwner: document.getElementById("f_businessOwner").checked,
    businessVintageYears: v("f_businessVintage") ? Number(v("f_businessVintage")) : null,
    gstRegistered: v("f_gstRegistered") === "yes",
    gstBusinessName: v("f_gstName").trim(),
    foirMet: v("f_foirMet") === "yes",
    foirPercent: v("f_foirPercent") ? Number(v("f_foirPercent")) : null,
    abbMultiple: v("f_abbMultiple") ? Number(v("f_abbMultiple")) : null,
    averageBankBalanceAmount: v("f_abbAmount") ? Number(v("f_abbAmount")) : null,
    resi: v("f_resi"),
  };
}

function showApplicantStatus(msg, kind) {
  const el = document.getElementById("applicantFormStatus");
  if (!el) return;
  el.innerHTML = msg ? `<div class="status-banner ${kind || "info"}">${esc(msg)}</div>` : "";
}

async function saveApplicant() {
  const payload = collectApplicantPayload();
  if (!payload.name) {
    showApplicantStatus("Please enter the applicant's name.", "error");
    return;
  }
  showApplicantStatus("");
  const btn = document.getElementById("saveApplicantBtn");
  if (btn) btn.disabled = true;
  try {
    let applicant;
    const id = getStoredApplicantId();
    if (id) {
      applicant = await api("/api/applicants/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(payload) });
    } else {
      applicant = await api("/api/applicants", { method: "POST", body: JSON.stringify(payload) });
    }
    CURRENT_APPLICANT = applicant;
    setStoredApplicantId(applicant.id);
    renderApplicantChip();
    showToast("Applicant info saved ✓");
    renderTabs(); // refresh "Editing applicant" header + the product tabs' notes
  } catch (err) {
    showApplicantStatus("Couldn't save: " + err.message, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function startNewApplicant() {
  if (CURRENT_APPLICANT && !confirm("Start a new applicant? The current one stays saved under Saved Applicants.")) return;
  CURRENT_APPLICANT = null;
  setStoredApplicantId(null);
  renderApplicantChip();
  renderTabs();
}

// ---------------- applicant chip (visible above the tabs, any tab) ----------------
function renderApplicantChip() {
  const el = document.getElementById("applicantChip");
  if (!el) return;
  if (!CURRENT_APPLICANT) {
    el.innerHTML = `<div class="status-banner info" style="margin-bottom:16px;">No applicant selected yet — start with <b>Applicant Info</b> below, or <a href="/applicants" style="color:inherit;font-weight:700;">pick a saved one</a>.</div>`;
    return;
  }
  const a = CURRENT_APPLICANT;
  el.innerHTML = `<div class="applicant-banner" style="margin-bottom:16px;">
    <div class="ab-main">👤 <b>${esc(a.name || "Unnamed applicant")}</b> · PAN ${esc(a.pan || "—")} · CIBIL ${a.cibil ?? "—"} · ${esc(a.location || "location not set")}</div>
    <a href="/applicants">Switch applicant →</a>
  </div>`;
}

// ---------------- init ----------------
renderApplicantChip();
renderTabs();

async function loadCurrentApplicant() {
  const id = getStoredApplicantId();
  if (!id) return;
  try {
    CURRENT_APPLICANT = await api("/api/applicants/" + encodeURIComponent(id));
  } catch (err) {
    CURRENT_APPLICANT = null;
    setStoredApplicantId(null);
  }
  renderApplicantChip();
  renderTabs();
}
loadCurrentApplicant();
