// frontend/js/insurance.js — AUDIT FIX PASS
// See Insurance_Module_Audit.md / Insurance_Edit_Fix_Report.md
//
// Changes in this revision:
//   ✅ FIX: saveInsurance() now parses the backend's JSON { error }
//      body and shows the real reason (e.g. "At least one employee
//      is required for SPECIFIC coverage" or a genuine server error)
//      instead of a generic "Error saving record" toast. Paired with
//      the backend fix in insurance.js (routes), which now always
//      returns JSON error bodies.
//   ✅ FIX: editInsurance() now calls closeDP() before opening the
//      edit modal, matching the pattern used by vehicles/laptops/etc.
//      (previously the detail panel stayed open underneath the modal
//      overlay — harmless visually, but inconsistent state that made
//      debugging "is edit actually working" harder during the audit).
//   ✅ FIX: deleteInsurancePrompt / confirmDeleteInsurance now also
//      parse and surface JSON error bodies.
//   No changes to coverage-type toggle logic, employee checkbox
//      logic, or attachment panel wiring — audited and confirmed
//      correct.

let insEditId = null;
let _allInsuranceUsers = []; // cache of all users for checkboxes

// ── Filter/pagination state ──
let insSearchQuery   = '';
let insFilterCoverage = 'all';
let insFilterStatus  = 'all';
let currentInsPage   = 1;
const insPerPage     = 20;
let _allInsurance    = [];

function _computeInsuranceStatus(ins) {
  const today  = new Date();
  const expiry = ins.expiry_date ? new Date(ins.expiry_date) : null;
  const daysLeft = expiry ? Math.ceil((expiry - today) / (1000 * 60 * 60 * 24)) : null;

  if (daysLeft === null)    return { badge: `<span class="badge b-slate">No expiry</span>`, status: 'none' };
  if (daysLeft < 0)        return { badge: `<span class="badge b-red">Expired</span>`, status: 'expired' };
  if (daysLeft <= 30)      return { badge: `<span class="badge b-amber">Expires in ${daysLeft}d</span>`, status: 'expiring' };
  return { badge: `<span class="badge b-green">Active</span>`, status: 'active' };
}

/* ── LOAD USERS FOR EMPLOYEE SELECTION ─────────────────── */
async function loadInsuranceUsers() {
  try {
    const res       = await fetch(`${API_URL}/api/auth/users`);
    _allInsuranceUsers = await res.json();
  } catch (err) {
    console.error('Failed to load users for insurance:', err);
  }
}

/* ── COVERAGE TYPE TOGGLE ───────────────────────────────── */
function toggleCoverageType() {
  const type = document.getElementById('ins-f-coverage').value;
  const empSection = document.getElementById('ins-emp-section');
  if (empSection) {
    empSection.style.display = type === 'SPECIFIC' ? 'block' : 'none';
  }
}

/* ── BUILD EMPLOYEE CHECKBOX LIST ───────────────────────── */
function buildEmployeeCheckboxes(selectedIds = []) {
  const container = document.getElementById('ins-emp-list');
  if (!container) return;

  if (!_allInsuranceUsers.length) {
    container.innerHTML = '<div style="color:var(--slate-400);font-size:12px">Loading users...</div>';
    return;
  }

  container.innerHTML = _allInsuranceUsers.map(u => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:13px;border-bottom:1px solid var(--slate-100)">
      <input type="checkbox" value="${u.user_id}"
        ${selectedIds.includes(u.user_id) ? 'checked' : ''}
        style="width:14px;height:14px;cursor:pointer;accent-color:var(--blue-600)"/>
      <span style="font-weight:600">${u.name}</span>
      ${u.department ? `<span style="color:var(--slate-400);font-size:11px;margin-left:auto">${u.department}</span>` : ''}
    </label>
  `).join('');
}

/* ── GET SELECTED EMPLOYEE IDS ──────────────────────────── */
function getSelectedEmployeeIds() {
  const checkboxes = document.querySelectorAll('#ins-emp-list input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

/* ── FILTER / PAGINATION ─────────────────────────────────── */
function applyInsFilters() {
  insFilterCoverage = document.getElementById('ins-filter-coverage').value;
  insFilterStatus   = document.getElementById('ins-filter-status').value;
  currentInsPage     = 1;
  _renderInsTable();
}

function _filterInsurance(data) {
  return data.filter(ins => {

    // Search — policy/plan name, provider
    if (insSearchQuery) {
      const haystack = `${ins.employee_name} ${ins.provider || ''}`.toLowerCase();
      if (!haystack.includes(insSearchQuery)) return false;
    }

    // Coverage filter
    if (insFilterCoverage !== 'all' && ins.coverage_type !== insFilterCoverage) return false;

    // Status filter
    if (insFilterStatus !== 'all') {
      const { status } = _computeInsuranceStatus(ins);
      if (status !== insFilterStatus) return false;
    }

    return true;
  });
}

function _renderInsPagination(total) {
  const container = document.getElementById('ins-pagination-container');
  if (!container) return;

  const totalPages = Math.ceil(total / insPerPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentInsPage === 1;
  prev.onclick = () => { currentInsPage--; _renderInsTable(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentInsPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => { currentInsPage = i; _renderInsTable(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentInsPage === totalPages;
  next.onclick = () => { currentInsPage++; _renderInsTable(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

/* ── RENDER TABLE ───────────────────────────────────────── */
function _renderInsTable() {
  const filtered  = _filterInsurance(_allInsurance);
  const total     = filtered.length;
  const start     = (currentInsPage - 1) * insPerPage;
  const paginated = filtered.slice(start, start + insPerPage);

  const tbody = document.getElementById("ins-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--slate-400)">No insurance records found.</td></tr>`;
  } else {
    paginated.forEach(ins => {
      const { badge: expiryBadge } = _computeInsuranceStatus(ins);

      const coverageBadge = ins.coverage_type === 'SPECIFIC'
        ? `<span class="badge b-blue">Specific</span>`
        : `<span class="badge b-slate">General</span>`;

      const tr = document.createElement("tr");
      tr.className = "tr-clickable";
      tr.innerHTML = `
        <td class="td-strong">${ins.employee_name}</td>
        <td>${ins.provider || "—"}</td>
        <td class="td-mono">${ins.policy_number || "—"}</td>
        <td>${formatDateHuman(ins.expiry_date)}</td>
        <td>${expiryBadge}</td>
        <td>${coverageBadge}</td>
      `;
      tr.addEventListener("click", () => openDP("insurance", ins.insurance_id, tr));
      tbody.appendChild(tr);
    });
  }

  const ctEl = document.getElementById("ins-ct");
  if (ctEl) ctEl.textContent = total + " records";
  _renderInsPagination(total);
}

async function renderInsurance() {
  try {
    const res     = await fetch(`${API_URL}/api/insurance`);
    _allInsurance = await res.json();
    currentInsPage = 1;
    _renderInsTable();
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
    else                     statusBadgeHtml = `<span class="badge b-green">Active</span>`;

    setDPHeader("🛡️", "#f0fdf4", ins.employee_name, "Insurance Record");

    // Coverage section
    const isSpecific = ins.coverage_type === 'SPECIFIC';
    const employees  = ins.assigned_employees || [];

    let coverageHTML = '';
    if (isSpecific) {
      if (employees.length > 0) {
        coverageHTML = `
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
                </div>
              `).join('')}
            </div>
          </div>`;
      } else {
        coverageHTML = `
          <div class="dp-section">
            <div class="dp-section-hd">👥 Assigned Employees</div>
            <div style="color:var(--slate-400);font-size:12px">No employees assigned yet.</div>
          </div>`;
      }
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

    const html = `
      <div class="dp-status-row">
        ${statusBadgeHtml}
        <span class="dp-status-label">Policy status</span>
        <span style="margin-left:auto"><span class="badge ${isSpecific ? 'b-blue' : 'b-slate'}">${isSpecific ? 'Specific' : 'General'} Coverage</span></span>
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

    attachmentPanel("insurance", id, `dp-att-ins-${id}`);
  } catch (err) {
    console.error("dpInsurance error:", err);
    showToast("Failed to load insurance record", "t-error");
  }
}

/* ── SAVE (create or edit) ──────────────────────────────── */
async function saveInsurance() {
  const employee_name = document.getElementById("ins-f-name").value.trim();
  const provider      = document.getElementById("ins-f-provider").value.trim();
  const policy_number = document.getElementById("ins-f-policy").value.trim();
  const start_date    = document.getElementById("ins-f-start").value || null;
  const expiry_date   = document.getElementById("ins-f-expiry").value || null;
  const remarks       = document.getElementById("ins-f-remarks").value;
  const coverage_type = document.getElementById("ins-f-coverage").value || 'GENERAL';

  if (!employee_name || !provider) {
    showToast("Policy name and provider are required", "t-error");
    return;
  }

  // Get selected employees
  const employee_ids = coverage_type === 'SPECIFIC' ? getSelectedEmployeeIds() : [];

  if (coverage_type === 'SPECIFIC' && employee_ids.length === 0) {
    showToast("Select at least one employee for specific coverage", "t-error");
    return;
  }

  const payload = { employee_name, provider, policy_number, start_date, expiry_date, remarks, coverage_type, employee_ids };
  const url     = insEditId ? `${API_URL}/api/insurance/${insEditId}` : `${API_URL}/api/insurance`;
  const method  = insEditId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  // ✅ FIX: parse the backend's JSON error body instead of throwing a
  // generic "Save failed" — the old code masked real causes (e.g. a
  // 500 from the employee-link insert) behind one generic toast.
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

/* ── EDIT ───────────────────────────────────────────────── */
async function editInsurance(id) {
  try {
    const res = await fetch(`${API_URL}/api/insurance/${id}`);
    const ins = await res.json();
    if (!ins) return;

    insEditId = id;

    // ✅ FIX: close the detail panel before opening the edit modal,
    // matching the pattern used elsewhere (vehicles, laptops, etc.)
    closeDP();

    document.getElementById("ins-f-name").value     = ins.employee_name  || "";
    document.getElementById("ins-f-provider").value = ins.provider       || "";
    document.getElementById("ins-f-policy").value   = ins.policy_number  || "";
    document.getElementById("ins-f-remarks").value  = ins.remarks        || "";
    document.getElementById("ins-f-coverage").value = ins.coverage_type  || "GENERAL";
    document.getElementById("ins-f-start").value    = ins.start_date
      ? new Date(ins.start_date).toISOString().slice(0,10) : "";
    document.getElementById("ins-f-expiry").value   = ins.expiry_date
      ? new Date(ins.expiry_date).toISOString().slice(0,10) : "";

    // Show/hide employee section
    toggleCoverageType();

    // Build checkboxes with pre-selected employees
    const selectedIds = (ins.assigned_employees || []).map(e => e.user_id);
    await loadInsuranceUsers();
    buildEmployeeCheckboxes(selectedIds);

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
    .then(res => {
      if (!res.ok) return res.json().catch(() => ({})).then(e => { throw new Error(e.error || "Delete failed"); });
    })
    .then(() => {
      showToast("Record deleted", "t-warning");
      addLog("DELETE", "INSURANCE", `Deleted insurance record #${deleteInsId}`, deleteInsId);
      closeM("m-confirm-ins-del");
      closeDP();
      renderInsurance();
    })
    .catch(err => {
      console.error(err);
      showToast(err.message || "Error deleting record", "t-error");
    });
}

/* ── OPEN ADD ───────────────────────────────────────────── */
async function openAddInsurance() {
  insEditId = null;
  await loadInsuranceUsers();
  buildEmployeeCheckboxes([]);
  toggleCoverageType();
  openM("m-ins-add");
}