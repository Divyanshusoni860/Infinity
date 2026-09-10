// public/applicants.js
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

async function load() {
  const listEl = document.getElementById("applicantsList");
  try {
    const applicants = await api("/api/applicants");
    if (applicants.length === 0) {
      listEl.innerHTML = `<div class="empty-state">No applicants saved yet — <a href="/profile" style="color:var(--primary);font-weight:700;">create the first one</a>.</div>`;
      return;
    }
    listEl.innerHTML = applicants.map((a) => `
      <div class="applicant-row">
        <div>
          <div class="ar-name">${esc(a.name || "Unnamed applicant")}</div>
          <div class="ar-meta">PAN ${esc(a.pan || "—")} · CIBIL ${a.cibil ?? "—"} · ${esc(a.location || "location not set")} · ${esc(a.phone || "no phone")}</div>
        </div>
        <div class="ar-actions">
          <a class="ar-btn-check" href="/check?applicantId=${encodeURIComponent(a.id)}">Check products</a>
          <a class="ar-btn-edit" href="/profile?applicantId=${encodeURIComponent(a.id)}">Edit</a>
          <button class="ar-btn-delete" onclick="removeApplicant('${a.id}')">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    document.getElementById("listStatus").innerHTML = `<div class="status-banner error">Couldn't load applicants: ${esc(err.message)}</div>`;
  }
}

async function removeApplicant(id) {
  if (!confirm("Delete this applicant profile? This can't be undone.")) return;
  try {
    await api("/api/applicants/" + encodeURIComponent(id), { method: "DELETE" });
    load();
  } catch (err) {
    alert("Couldn't delete: " + err.message);
  }
}

load();
