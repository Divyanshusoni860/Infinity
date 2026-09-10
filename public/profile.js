// public/profile.js
// Applicant intake form. Works in two modes:
//   /profile              -> create a brand-new applicant
//   /profile?applicantId=X -> load and edit an existing one
// On save, redirects to /check?applicantId=X so the person can
// immediately run any product check against the saved profile.

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
function showStatus(message, kind) {
  const el = document.getElementById("formStatus");
  if (!message) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="status-banner ${kind || "info"}">${esc(message)}</div>`;
}

const params = new URLSearchParams(location.search);
const editingId = params.get("applicantId");

function toggleBusinessFields() {
  const show = document.getElementById("f_itr").checked || document.getElementById("f_businessOwner").checked;
  document.getElementById("businessFields").style.display = show ? "grid" : "none";
}

function fill(applicant) {
  document.getElementById("f_name").value = applicant.name || "";
  document.getElementById("f_phone").value = applicant.phone || "";
  document.getElementById("f_email").value = applicant.email || "";
  document.getElementById("f_location").value = applicant.location || "";
  document.getElementById("f_pan").value = applicant.pan || "";
  document.getElementById("f_cibil").value = applicant.cibil ?? "";
  document.getElementById("f_employment").value = applicant.employment || "salaried";
  document.getElementById("f_age").value = applicant.age ?? "";
  document.getElementById("f_itr").checked = !!applicant.itr;
  document.getElementById("f_businessOwner").checked = !!applicant.businessOwner;
  document.getElementById("f_businessVintage").value = applicant.businessVintageYears ?? "";
  document.getElementById("f_gstRegistered").value = applicant.gstRegistered ? "yes" : "no";
  document.getElementById("f_gstName").value = applicant.gstBusinessName || "";
  document.getElementById("f_foirMet").value = applicant.foirMet === false ? "no" : "yes";
  document.getElementById("f_foirPercent").value = applicant.foirPercent ?? "";
  document.getElementById("f_abbMultiple").value = applicant.abbMultiple ?? "";
  document.getElementById("f_abbAmount").value = applicant.averageBankBalanceAmount ?? "";
  document.getElementById("f_resi").value = applicant.resi || "owned";
  toggleBusinessFields();
}

async function loadForEdit() {
  document.getElementById("pageSub").textContent = "Edit Applicant Profile";
  document.getElementById("saveBtn").textContent = "Save changes →";
  try {
    const applicant = await api("/api/applicants/" + encodeURIComponent(editingId));
    fill(applicant);
  } catch (err) {
    showStatus("Couldn't load this applicant: " + err.message, "error");
  }
}

function collectPayload() {
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

async function saveProfile() {
  const payload = collectPayload();
  if (!payload.name) {
    showStatus("Please enter the applicant's name.", "error");
    return;
  }
  showStatus("");
  try {
    let applicant;
    if (editingId) {
      applicant = await api("/api/applicants/" + encodeURIComponent(editingId), {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      applicant = await api("/api/applicants", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    location.href = "/check?applicantId=" + encodeURIComponent(applicant.id);
  } catch (err) {
    showStatus("Couldn't save profile: " + err.message, "error");
  }
}

if (editingId) loadForEdit();
