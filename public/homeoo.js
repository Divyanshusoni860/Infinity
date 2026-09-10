// public/home.js
// Renders the vertical tool tabs on the home dashboard. Each tool is a
// simple data record — active tools link straight to their page, dummy
// ("coming soon") tools just show a placeholder in the panel so they're
// easy to flip on later (add href + badge:"ready").

const TOOLS = [
  {
    id: "bt-topup",
    icon: "🚗",
    name: "Car Loan BT Top-Up",
    badge: "ready",
    href: "/bt-topup",
    desc: "Check balance-transfer + top-up eligibility across 16 lenders for an existing car loan, ranked by best offer.",
  },
  {
    id: "refinance",
    icon: "🔁",
    name: "Car Refinance",
    badge: "ready",
    href: "/refinance",
    desc: "For a fully-owned vehicle with no existing loan — check refinance eligibility against 5 lenders, ranked by best loan amount.",
  },
  {
    id: "home-loan",
    icon: "🏠",
    name: "Home Loan BT Top-Up",
    badge: "soon",
    href: null,
    desc: "Same idea as the car loan tool, tuned for home loan balance transfer policies. Not activated yet.",
  },
  {
    id: "personal-loan",
    icon: "💳",
    name: "Personal Loan Eligibility",
    badge: "soon",
    href: null,
    desc: "Compare personal loan offers across lenders based on income and credit profile. Not activated yet.",
  },
  {
    id: "business-loan",
    icon: "🏢",
    name: "Business Loan Eligibility",
    badge: "soon",
    href: null,
    desc: "Eligibility and offer comparison for business / working-capital loans. Not activated yet.",
  },
  {
    id: "lap",
    icon: "📄",
    name: "Loan Against Property",
    badge: "soon",
    href: null,
    desc: "LAP eligibility and top-up comparison across lender policies. Not activated yet.",
  },
  {
    id: "emi-calculator",
    icon: "🧮",
    name: "EMI Calculator",
    badge: "ready",
    href: "/emi-calculator",
    desc: "Work out monthly EMI, total interest, and total payout for any loan amount and tenure.",
  },
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
  if (!t) { panel.innerHTML = ""; return; }
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

renderTabs();
