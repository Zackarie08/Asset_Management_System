// ============================================================
// insurance.js — Employee Insurance module
// NEW: This module was referenced in the HTML but had no JS.
// Follows the same pattern as other modules (table + DP + modals)
// ============================================================

let insEditId = null;

/* ── RENDER TABLE ───────────────────────────────────────── */
async function renderInsurance() {
  try {
    const res  = await fetch(`${API_URL}/api/insurance`);
    const data = await res.json();

    const tbody = document.getElementById("ins-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const today = new Date();

    data.forEach(ins => {
      const expiry   = ins.expiry_date ? new Date(ins.expiry_date) : null;
      const daysLeft = expiry ? Math.ceil((expiry - today) / (1000 * 60 * 60 * 24)) : null;

      let expiryBadge = "";
      if (daysLeft === null)    expiryBadge = `<span class="badge b-slate">No expiry</span>`;
      else if (daysLeft < 0)   expiryBadge = `<span class="badge b-red">Expired</span>`;
      else if (daysLeft <= 30) expiryBadge = `<span class="badge b-amber">Expires in ${daysLeft}d</span>`;
      else                      expiryBadge = `<span class="badge b-green">Active</span>`;

      const tr = document.createElement("tr");
      tr.className = "tr-clickable";
      tr.innerHTML = `
        <td class="td-strong">${ins.employee_name}</td>
        <td>${ins.provider || "—"}</td>
        <td class="td-mono">${ins.policy_number || "—"}</td>
        <td>${ins.expiry_date ? new Date(ins.expiry_date).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—"}</td>
        <td>${expiryBadge}</td>
      `;
      tr.addEventListener("click", () => openDP("insurance", ins.insurance_id, tr));
      tbody.appendChild(tr);
    });

    const ctEl = document.getElementById("ins-ct");
    if (ctEl) ctEl.textContent = data.length + " records";
  } catch (err) {
    console.error("renderInsurance error:", err);
    showToast("Failed to load insurance records", "t-error");
  }
}

/* ── DETAIL PANEL ───────────────────────────────────────── */
async function dpInsurance(id) {
  try {
    const res = await fetch(`${API_URL}/api/insurance/${id}`);
    const ins = await res.json();
    if (!ins) return;

    const today    = new Date();
    const expiry   = ins.expiry_date ? new Date(ins.expiry_date) : null;
    const daysLeft = expiry ? Math.ceil((expiry - today) / (1000 * 60 * 60 * 24)) : null;

    let statusBadgeHtml = "";
    if (daysLeft === null)    statusBadgeHtml = `<span class="badge b-slate">No expiry set</span>`;
    else if (daysLeft < 0)   statusBadgeHtml = `<span class="badge b-red">Expired</span>`;
    else if (daysLeft <= 30) statusBadgeHtml = `<span class="badge b-amber">Expires in ${daysLeft} days</span>`;
    else                      statusBadgeHtml = `<span class="badge b-green">Active</span>`;

    setDPHeader("🛡️", "#f0fdf4", ins.employee_name, "Insurance Record");

    const html = `
      <div class="dp-status-row">
        ${statusBadgeHtml}
        <span class="dp-status-label">Policy status</span>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd">📋 Policy Details</div>
        <div class="dp-grid">
          ${dpField("Employee",      ins.employee_name)}
          ${dpField("Provider",      ins.provider    || "—")}
          ${dpField("Policy Number", ins.policy_number || "—")}
          ${dpField("Start Date",    ins.start_date  ? new Date(ins.start_date).toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"}) : "—")}
          ${dpField("Expiry Date",   ins.expiry_date ? new Date(ins.expiry_date).toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"}) : "—")}
        </div>
      </div>
      ${ins.remarks ? `
        <div class="dp-section">
          <div class="dp-section-hd">📝 Remarks</div>
          <div class="dp-grid">${dpFieldFull("Notes", ins.remarks)}</div>
        </div>` : ""}
      <div class="dp-section" id="dp-att-ins-${id}"></div>
      ${isAdminUser() ? `
        <div class="dp-section">
          <div class="dp-section-hd">⚡ Actions</div>
          <div class="dp-action-row">
            <button class="btn btn-primary btn-sm" onclick="editInsurance(${ins.insurance_id})">✏️ Edit</button>
            <button class="btn btn-red btn-sm"     onclick="deleteInsurancePrompt(${ins.insurance_id})">🗑️ Delete</button>
          </div>
        </div>` : ""}`;

    document.getElementById("dp-body").innerHTML = html;
    document.getElementById("dp-footer").style.display = "none";

    // Attachments panel (always shown)
    attachmentPanel("insurance", id, `dp-att-ins-${id}`);
  } catch (err) {
    console.error("dpInsurance error:", err);
    showToast("Failed to load insurance record", "t-error");
  }
}

/* ── SAVE (create or edit) ──────────────────────────────── */
function saveInsurance() {
  const employee_name  = document.getElementById("ins-f-name").value.trim();
  const provider       = document.getElementById("ins-f-provider").value.trim();
  const policy_number  = document.getElementById("ins-f-policy").value.trim();
  const start_date     = document.getElementById("ins-f-start").value || null;
  const expiry_date    = document.getElementById("ins-f-expiry").value || null;
  const remarks        = document.getElementById("ins-f-remarks").value;

  if (!employee_name || !provider) {
    showToast("Employee name and provider are required", "t-error");
    return;
  }

  const payload = { employee_name, provider, policy_number, start_date, expiry_date, remarks };
  const url     = insEditId ? `${API_URL}/api/insurance/${insEditId}` : `${API_URL}/api/insurance`;
  const method  = insEditId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => { if (!res.ok) throw new Error("Save failed"); return res.json(); })
  .then(() => {
    showToast(insEditId ? "Record updated" : "Record added", "t-success");
    addLog(insEditId ? "UPDATE" : "CREATE", "INSURANCE",
      `${insEditId ? "Updated" : "Added"} insurance for ${employee_name}`, insEditId || null);
    insEditId = null;
    closeM("m-ins-add");
    renderInsurance();
    if (dpOpen && dpCurrentType === "insurance") dpInsurance(dpCurrentId);
  })
  .catch(err => {
    console.error(err);
    showToast("Error saving record", "t-error");
  });
}

/* ── EDIT ───────────────────────────────────────────────── */
async function editInsurance(id) {
  try {
    const res = await fetch(`${API_URL}/api/insurance/${id}`);
    const ins = await res.json();
    if (!ins) return;

    insEditId = id;

    document.getElementById("ins-f-name").value     = ins.employee_name  || "";
    document.getElementById("ins-f-provider").value = ins.provider       || "";
    document.getElementById("ins-f-policy").value   = ins.policy_number  || "";
    document.getElementById("ins-f-remarks").value  = ins.remarks        || "";
    document.getElementById("ins-f-start").value    = ins.start_date
      ? new Date(ins.start_date).toISOString().slice(0,10) : "";
    document.getElementById("ins-f-expiry").value   = ins.expiry_date
      ? new Date(ins.expiry_date).toISOString().slice(0,10) : "";

    openM("m-ins-add");
  } catch (err) {
    console.error(err);
    showToast("Failed to load record for editing", "t-error");
  }
}

/* ── DELETE ─────────────────────────────────────────────── */
let deleteInsId = null;

function deleteInsurancePrompt(id) {
  deleteInsId = id;
  openM("m-confirm-ins-del");
}

function confirmDeleteInsurance() {
  fetch(`${API_URL}/api/insurance/${deleteInsId}`, { method: "DELETE" })
    .then(res => { if (!res.ok) throw new Error("Delete failed"); })
    .then(() => {
      showToast("Record deleted", "t-warning");
      addLog("DELETE", "INSURANCE", `Deleted insurance record #${deleteInsId}`, deleteInsId);
      closeM("m-confirm-ins-del");
      closeDP();
      renderInsurance();
    })
    .catch(err => {
      console.error(err);
      showToast("Error deleting record", "t-error");
    });
}
