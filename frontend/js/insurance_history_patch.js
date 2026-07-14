/* ============================================================
   insurance_history_patch.js — Part 6
   ============================================================
   Adds:
     - "Select All Employees" checkbox above the roster list.
     - Collapsible employee list (toggleInsEmpCollapse()).
     - "View Item History" button on the insurance DP.
     - user_id/performed_by now sent on save, so backend history
       attribution (Part 6 backend) is fully populated, not null.

   Load AFTER insurance_custom_patch.js and item_history_panel.js.
   Overrides buildEmployeeCheckboxes(), getSelectedEmployeeIds(),
   saveInsurance(), and dpInsurance() from that file.

   NOTE: requires the index.html patch in Insurance_Enhancements.md
   (adds the collapse header + #ins-emp-list-wrap wrapper).
   ============================================================ */

function buildEmployeeCheckboxes(selectedIds = []) {
  const container = document.getElementById('ins-emp-list');
  if (!container) return;

  if (!_allInsuranceUsers.length) {
    container.innerHTML = '<div style="color:var(--slate-400);font-size:12px">Loading users...</div>';
    return;
  }

  const allSelected = _allInsuranceUsers.length > 0 &&
    _allInsuranceUsers.every(u => selectedIds.includes(u.user_id));

  container.innerHTML = `
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0 10px;cursor:pointer;font-size:12.5px;font-weight:700;border-bottom:1.5px solid var(--slate-200);margin-bottom:6px">
      <input type="checkbox" id="ins-emp-select-all" ${allSelected ? 'checked' : ''}
        onchange="toggleAllInsuranceEmployees(this.checked)"
        style="width:14px;height:14px;cursor:pointer;accent-color:var(--blue-600)"/>
      <span>Select All Employees (${_allInsuranceUsers.length})</span>
    </label>
    ${_allInsuranceUsers.map(u => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:13px;border-bottom:1px solid var(--slate-100)">
        <input type="checkbox" class="ins-emp-checkbox" value="${u.user_id}"
          ${selectedIds.includes(u.user_id) ? 'checked' : ''}
          onchange="_syncInsSelectAllState()"
          style="width:14px;height:14px;cursor:pointer;accent-color:var(--blue-600)"/>
        <span style="font-weight:600">${u.name}</span>
        ${u.department ? `<span style="color:var(--slate-400);font-size:11px;margin-left:auto">${u.department}</span>` : ''}
      </label>
    `).join('')}
  `;
}

function toggleAllInsuranceEmployees(checked) {
  document.querySelectorAll('#ins-emp-list .ins-emp-checkbox').forEach(cb => { cb.checked = checked; });
}

function _syncInsSelectAllState() {
  const all = document.querySelectorAll('#ins-emp-list .ins-emp-checkbox');
  const checkedCount = document.querySelectorAll('#ins-emp-list .ins-emp-checkbox:checked').length;
  const selectAll = document.getElementById('ins-emp-select-all');
  if (selectAll) selectAll.checked = all.length > 0 && checkedCount === all.length;
}

function getSelectedEmployeeIds() {
  const checkboxes = document.querySelectorAll('#ins-emp-list .ins-emp-checkbox:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

function toggleInsEmpCollapse() {
  const wrap  = document.getElementById('ins-emp-list-wrap');
  const arrow = document.getElementById('ins-emp-collapse-arrow');
  if (!wrap) return;
  const collapsed = wrap.style.display === 'none';
  wrap.style.display = collapsed ? 'block' : 'none';
  if (arrow) arrow.textContent = collapsed ? '▼ Hide' : '▲ Show';
}

/* ── SAVE — now includes user_id/performed_by for history attribution ── */
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

  const payload = {
    employee_name, provider, policy_number, start_date, expiry_date, remarks,
    coverage_type, employee_ids, coverage_target,
    user_id: currentUser.user_id,
    performed_by: currentUser.name,
  };
  const url    = insEditId ? `${API_URL}/api/insurance/${insEditId}` : `${API_URL}/api/insurance`;
  const method = insEditId ? "PUT" : "POST";

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

/* ── DP: add View Item History (everything else same as prior patch) ── */
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
          <div class="dp-section-hd">🎯 Coverage Scope</div>
          <div class="dp-grid">
            ${dpFieldFull('Custom Target', ins.coverage_target || '—')}
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
      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
          ${isAdminUser() ? `
            <button class="btn btn-primary btn-sm" onclick="editInsurance(${ins.insurance_id})">✏️ Edit</button>
            <button class="btn btn-red btn-sm"     onclick="deleteInsurancePrompt(${ins.insurance_id})">🗑️ Delete</button>
          ` : ''}
          ${itemHistoryButton('insurance', ins.insurance_id, ins.employee_name)}
        </div>
      </div>`;

    document.getElementById("dp-body").innerHTML = html;
    document.getElementById("dp-footer").style.display = "none";
    attachmentPanel("insurance", id, `dp-att-ins-${id}`);
  } catch (err) {
    console.error("dpInsurance error:", err);
    showToast("Failed to load insurance record", "t-error");
  }
}

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.insurance = dpInsurance;
