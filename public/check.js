// public/check.js
// Hub page: shows the saved applicant and lets you jump into any product
// check with that profile already carried over via ?applicantId=.

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

const params = new URLSearchParams(location.search);
const applicantId = params.get("applicantId");
const qs = applicantId ? "?applicantId=" + encodeURIComponent(applicantId) : "";

const TOOLS = [
  { id: "bt-topup", icon: "🚗", name: "Car Loan BT Top-Up", badge: "ready", href: "/bt-topup" + qs,
    desc: "Check balance-transfer + top-up eligibility across 16 lenders for an existing car loan." },
  { id: "refinance", icon: "🔁", name: "Car Refinance", badge: "ready", href: "/refinance" + qs,
    desc: "For a fully-owned vehicle with no existing loan — check refinance eligibility across 5 lenders." },
  { id: "home-loan", icon: "🏠", name: "Home Loan BT Top-Up", badge: "soon", href: null,
    desc: "Same idea, tuned for home loan balance transfer policies. Not activated yet." },
  { id: "personal-loan", icon: "💳", name: "Personal Loan Eligibility", badge: "soon", href: null,
    desc: "Compare personal loan offers based on income and credit profile. Not activated yet." },
  { id: "business-loan", icon: "🏢", name: "Business Loan Eligibility", badge: "soon", href: null,
    desc: "Eligibility and offer comparison for business / working-capital loans. Not activated yet." },
  { id: "lap", icon: "📄", name: "Loan Against Property", badge: "soon", href: null,
    desc: "LAP eligibility and top-up comparison across lender policies. Not activated yet." },
];

let activeTool = TOOLS[0].id;

function renderTabs() {
  const nav = document.getElementById("vtabsNav");
  nav.innerHTML = TOOLS.map((t) => `
    <button class="vtab-btn ${t.id === activeTool ? "active" : ""}" onclick="selectTool('${t.id}')">
      <span class="vt-icon">${t.icon}</span>
      <span class="vt-name">${t.name}</span>
      <span class="vt-badge ${t.badge}">${t.badge === "ready" ? "Ready" : "Coming soon"}</span>
    </button>
  `).join("");
  renderPanel();
}

function renderPanel() {
  const t = TOOLS.find((x) => x.id === activeTool);
  const panel = document.getElementById("vtabsPanel");
  panel.innerHTML = `
    <div class="vp-icon">${t.icon}</div>
    <h3>${t.name}</h3>
    <p>${t.desc}</p>
    ${t.href
      ? `<a class="btn-primary hero-btn" href="${t.href}">Open ${t.name} →</a>`
      : `<button class="btn-primary hero-btn" disabled style="opacity:0.5;cursor:not-allowed;">Coming soon</button>`}
  `;
}

function selectTool(id) {
  activeTool = id;
  renderTabs();
}

async function loadApplicant() {
  const el = document.getElementById("applicantBanner");
  if (!applicantId) {
    el.innerHTML = `<div class="status-banner info">No applicant selected — you can still check any tool manually, or <a href="/profile" style="color:inherit;font-weight:700;">create a new applicant profile</a> first.</div>`;
    return;
  }
  try {
    const a = await api("/api/applicants/" + encodeURIComponent(applicantId));
    el.innerHTML = `<div class="applicant-banner">
      <div class="ab-main"><b>${esc(a.name || "Unnamed applicant")}</b> · PAN ${esc(a.pan || "—")} · CIBIL ${a.cibil ?? "—"} · ${esc(a.location || "location not set")}</div>
      <a href="/profile?applicantId=${encodeURIComponent(a.id)}">Edit profile</a>
    </div>`;
  } catch (err) {
    el.innerHTML = `<div class="status-banner error">Couldn't load applicant: ${esc(err.message)}</div>`;
  }
}

renderTabs();
loadApplicant();
