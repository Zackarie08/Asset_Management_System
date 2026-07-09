/* ============================================================
   insurance_custom_patch.js
   ============================================================
   Adds CUSTOM coverage type support on top of insurance.js.
   Load AFTER insurance.js (order after main.js, same as other
   patch files, is fine too).

   REQUIRED index.html changes — see
   Insurance_Custom_Coverage_Update.md for exact find/replace.
   ============================================================ */

function toggleCoverageType() {
  const type = document.getElementById('ins-f-coverage').value;
  const empSection    = document.getElementById('ins-emp-section');
  const targetSection = document.getElementById('ins-target-section');
  if (empSection)    empSection.style.display    = type === 'SPECIFIC' ? 'block' : 'none';
  if (targetSection) targetSection.style.display = type === 'CUSTOM'   ? 'block' : 'none';
}

async function saveInsurance() {
  const employee_name = document.getElementById("ins-f-name").value.trim();
  const provider      = document.getElementById("ins-f-provider").value.trim();
  const policy_number = document.getElementById("ins-f-policy").value.trim();
  const start_date    = document.getElementById("ins-f-start").value || null;
  const expiry_date   = document.getElementById("ins-f-expiry").value || null;
  const remarks       = document.getElementById("ins-f-remarks").value;
  const coverage_type = document.getElementById("ins-f-coverage").value || 'GENERAL';
  const coverage_target = document.getElementById("ins-f-target")?.value.trim() || '';

  if (!employee_name || !provider) {
    showToast("Policy name and provider are required", "t-error");
    return;
  }

  const employee_ids = coverage_type === 'SPECIFIC' ? getSelectedEmployeeIds() : [];

  if (coverage_type === 'SPECIFIC' && employee_ids.length === 0) {
    showToast("Select at least one employee for specific coverage", "t-error");
    return;
  }
  if (coverage_type === 'CUSTOM' && !coverage_target) {
    showToast("Enter a Coverage Target for custom coverage", "t-error");
    return;
  }

  const payload = { employee_name, provider, policy_number, start_date, expiry_date, remarks, coverage_type, employee_ids, coverage_target };
  const url     = insEditId ? `${API_URL}/api/insurance/${insEditId}` : `${API_URL}/api/insurance`;
  const method  = insEditId ? "PUT" : "POST";

  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    .then(res => {
      if (!res.ok) return res.json().catch(() => ({})).then(e => { throw new Error(e.error || "Save failed"); });
      return res.json();
    })
    .then(() => {
      showToast(insEditId ? "Record updated" : "Record added", "t-success");
      addLog(insEditId ? "UPDATE" : "CREATE", "INSURANCE",
        `${insEditId ? "Updated" : "Added"} insurance: ${employee_name}`, insEditId || null);
      insEditId = null;
      closeM("m-ins-add");
      renderInsurance();
      if (dpOpen && dpCurrentType === "insurance") dpInsurance(dpCurrentId);
    })
    .catch(err => {
      console.error(err);
      showToast(err.message || "Error saving record", "t-error");
    });
}

async function editInsurance(id) {
  try {
    const res = await fetch(`${API_URL}/api/insurance/${id}`);
    const ins = await res.json();
    if (!ins) return;

    insEditId = id;
    closeDP();

    document.getElementById("ins-f-name").value     = ins.employee_name  || "";
    document.getElementById("ins-f-provider").value = ins.provider       || "";
    document.getElementById("ins-f-policy").value   = ins.policy_number  || "";
    document.getElementById("ins-f-remarks").value  = ins.remarks        || "";
    document.getElementById("ins-f-coverage").value = ins.coverage_type  || "GENERAL";
    const targetEl = document.getElementById("ins-f-target");
    if (targetEl) targetEl.value = ins.coverage_target || "";
    document.getElementById("ins-f-start").value    = ins.start_date  ? new Date(ins.start_date).toISOString().slice(0,10)  : "";
    document.getElementById("ins-f-expiry").value   = ins.expiry_date ? new Date(ins.expiry_date).toISOString().slice(0,10) : "";

    toggleCoverageType();

    const selectedIds = (ins.assigned_employees || []).map(e => e.user_id);
    await loadInsuranceUsers();
    buildEmployeeCheckboxes(selectedIds);

    openM("m-ins-add");
  } catch (err) {
    console.error(err);
    showToast("Failed to load record for editing", "t-error");
  }
}

async function dpInsurance(id) {
  try {
    const res = await fetch(`${API_URL}/api/insurance/${id}`);
    const ins = await res.json();
    if (!ins) return;

    const today    = new Date();
    const expiry   = ins.expiry_date ? new Date(ins.expiry_date) : null;
    const daysLeft = expiry ? Math.ceil((expiry - today) / 86400000) : null;

    let statusBadgeHtml = "";
    if (daysLeft === null)    statusBadgeHtml = `<span class="badge b-slate">No expiry set</span>`;
    else if (daysLeft < 0)   statusBadgeHtml = `<span class="badge b-red">Expired</span>`;
    else if (daysLeft <= 30) statusBadgeHtml = `<span class="badge b-amber">Expires in ${daysLeft} days</span>`;
    else                     statusBadgeHtml = `<span class="badge b-green">Active</span>`;

    setDPHeader("🛡️", "#f0fdf4", ins.employee_name, "Insurance Record");

    const isSpecific = ins.coverage_type === 'SPECIFIC';
    const isCustom    = ins.coverage_type === 'CUSTOM';
    const employees  = ins.assigned_employees || [];

    let coverageHTML = '';
    if (isSpecific) {
      coverageHTML = employees.length ? `
          <div class="dp-section">
            <div class="dp-section-hd">👥 Assigned Employees (${employees.length})</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${employees.map(e => `
                <div style="display:flex;align-items:center;gap:8px;background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius-sm);padding:8px 10px">
                  <span style="font-size:16px">👤</span>
                  <div>
                    <div style="font-size:13px;font-weight:600">${e.name}</div>
                    ${e.department ? `<div style="font-size:11px;color:var(--slate-400)">${e.department}</div>` : ''}
                  </div>
                </div>`).join('')}
            </div>
          </div>` : `
          <div class="dp-section">
            <div class="dp-section-hd">👥 Assigned Employees</div>
            <div style="color:var(--slate-400);font-size:12px">No employees assigned yet.</div>
          </div>`;
    } else if (isCustom) {
      coverageHTML = `
        <div class="dp-section">
          <div class="dp-section-hd">🎯 Coverage Target</div>
          <div style="display:flex;align-items:center;gap:8px;background:var(--blue-50);border:1px solid var(--blue-100);border-radius:var(--radius-sm);padding:10px 12px">
            <span style="font-size:18px">🎯</span>
            <span style="font-size:13px;font-weight:600;color:#1e40af">${ins.coverage_target || '—'}</span>
          </div>
        </div>`;
    } else {
      coverageHTML = `
        <div class="dp-section">
          <div class="dp-section-hd">👥 Coverage</div>
          <div style="display:flex;align-items:center;gap:8px;background:var(--green-50);border:1px solid var(--green-100);border-radius:var(--radius-sm);padding:10px 12px">
            <span style="font-size:18px">🌐</span>
            <span style="font-size:13px;font-weight:600;color:#166534">Applies to all employees</span>
          </div>
        </div>`;
    }

    const coverageBadgeCls = isSpecific ? 'b-blue' : isCustom ? 'b-purple' : 'b-slate';
    const coverageBadgeLbl = isSpecific ? 'Specific' : isCustom ? 'Custom' : 'General';

    const html = `
      <div class="dp-status-row">
        ${statusBadgeHtml}
        <span class="dp-status-label">Policy status</span>
        <span style="margin-left:auto"><span class="badge ${coverageBadgeCls}">${coverageBadgeLbl} Coverage</span></span>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd">📋 Policy Details</div>
        <div class="dp-grid">
          ${dpField("Policy Name",   ins.employee_name)}
          ${dpField("Provider",      ins.provider || "—")}
          ${dpField("Policy Number", ins.policy_number || "—")}
          ${dpField("Start Date",    formatDateHuman(ins.start_date))}
          ${dpField("Expiry Date",   formatDateHuman(ins.expiry_date))}
        </div>
      </div>
      ${coverageHTML}
      ${ins.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull("Notes", ins.remarks)}</div></div>` : ""}
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
    attachmentPanel("insurance", id, `dp-att-ins-${id}`);
  } catch (err) {
    console.error("dpInsurance error:", err);
    showToast("Failed to load insurance record", "t-error");
  }
}
