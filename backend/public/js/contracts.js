
/* ──────────────────────────────────────────────────────────────
   CONTRACTS
────────────────────────────────────────────────────────────── */

let deleteContractId = null;

// ── Filter/pagination state ──
let conSearchQuery    = '';
let conFilterValidity = 'all';
let conFilterExpiry   = 'all';
let conFilterStatus   = 'all';
let conFilterDate     = 'all';
let conDateFrom       = '';
let conDateTo         = '';
let currentConPage    = 1;
const conPerPage      = 20;
let _allContracts     = [];

// ── Shared expiry computation (used by table + filters) ──
function _computeContractExpiry(c) {
  if (c.validity_type === 'NA') {
    return { badge: `<span class="badge b-slate">N/A</span>`, status: 'na' };
  }
  const expiryDate = c.validity_type === "YEAR"
    ? new Date(`${c.valid_year}-12-31`)
    : c.valid_to ? new Date(c.valid_to) : null;

  if (!expiryDate) return { badge: '—', status: 'na' };

  const days = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0)   return { badge: `<span class="badge b-red">Expired</span>`, status: 'expired' };
  if (days <= 30) return { badge: `<span class="badge b-amber">Expires in ${days}d</span>`, status: 'expiring' };
  return { badge: `<span class="badge b-green">Valid</span>`, status: 'valid' };
}
// ✅ NEW: single source of truth for the contract status badge.
// Shows the actual current holder ("With <Name>") instead of the raw
// WITH_EMPLOYEE status string. Used by both the table and the detail panel
// so they can never drift out of sync again.
function _contractStatusLabel(c) {
  if (c.status === 'IN_STORAGE') {
    return `<span class="badge b-green">In Storage</span>`;
  }
  if (c.status === 'WITH_EMPLOYEE') {
    const holder = c.current_holder_name ? `With ${_esc(c.current_holder_name)}` : 'With Employee';
    return `<span class="badge b-blue">${holder}</span>`;
  }
  return `<span class="badge b-slate">${c.status || '—'}</span>`;
}

async function renderContracts() {
  try {
    const res     = await fetch(`${API_URL}/api/contracts`);
    _allContracts = await res.json();
    currentConPage = 1;
    _renderConTable();
  } catch (err) {
    console.error("renderContracts error:", err);
    showToast("Failed to load contracts", "t-error");
  }
}

function applyConFilters() {
  conFilterValidity = document.getElementById('con-filter-validity').value;
  conFilterExpiry   = document.getElementById('con-filter-expiry').value;
  conFilterStatus   = document.getElementById('con-filter-status').value;
  conFilterDate     = document.getElementById('con-filter-date').value;
  conDateFrom       = document.getElementById('con-date-from')?.value || '';
  conDateTo         = document.getElementById('con-date-to')?.value   || '';
  currentConPage    = 1;

  const customRange = document.getElementById('con-custom-range');
  if (customRange) {
    customRange.style.display = conFilterDate === 'custom' ? 'flex' : 'none';
  }

  _renderConTable();
}

function _filterContracts(data) {
  const now      = new Date();
  const thisYear = now.getFullYear();

  return data.filter(c => {

    // Search — other party or description
    if (conSearchQuery) {
      const haystack = `${c.other_party} ${c.description}`.toLowerCase();
      if (!haystack.includes(conSearchQuery)) return false;
    }

    // Validity type filter
    if (conFilterValidity !== 'all' && c.validity_type !== conFilterValidity) return false;

    // Expiry status filter
    if (conFilterExpiry !== 'all') {
      const { status } = _computeContractExpiry(c);
      if (status !== conFilterExpiry) return false;
    }

    // Status filter
    if (conFilterStatus !== 'all' && c.status !== conFilterStatus) return false;

    // Date filter (on contract_date)
    if (conFilterDate !== 'all' && c.contract_date) {
      const d = new Date(c.contract_date);

      if (conFilterDate === 'this_year') {
        if (d.getFullYear() !== thisYear) return false;

      } else if (conFilterDate === 'last_year') {
        if (d.getFullYear() !== thisYear - 1) return false;

      } else if (conFilterDate === 'custom') {
        if (conDateFrom && d < new Date(conDateFrom)) return false;
        if (conDateTo) {
          const to = new Date(conDateTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
      }
    }

    return true;
  });
}

function _renderConTable() {
  const filtered  = _filterContracts(_allContracts);
  const total     = filtered.length;
  const start     = (currentConPage - 1) * conPerPage;
  const paginated = filtered.slice(start, start + conPerPage);

  const tbody = document.getElementById("con-tbody");
  tbody.innerHTML = "";

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--slate-400)">No contracts found.</td></tr>`;
  } else {
    paginated.forEach(c => {
      let validity = '—';
      if (c.validity_type === 'NA') {
        validity = '<span class="badge b-slate">No Expiration</span>';
      } else if (c.validity_type === 'YEAR') {
        validity = c.valid_year || '—';
      } else {
        validity = `${formatDateHuman(c.valid_from)} — ${formatDateHuman(c.valid_to)}`;
      }

      const { badge: expiryBadge } = _computeContractExpiry(c);

      const tr = document.createElement("tr");
      tr.className = "tr-clickable";
      tr.innerHTML = `
        <td class="td-strong">${c.other_party}</td>
        <td>${formatDateHuman(c.contract_date)}</td>
        <td>${c.description}</td>
        <td>${validity}</td>
        <td>${expiryBadge}</td>
      `;
      tr.onclick = () => openDP("contracts", c.contract_id, tr);
      tbody.appendChild(tr);
    });
  }

  document.getElementById("con-ct").textContent = total + " records";
  _renderConPagination(total);
}

// ✅ CHANGED: now delegates to the shared sliding-window pagination helper
function _renderConPagination(total) {
  renderPaginationControls('con-pagination-container', total, conPerPage, currentConPage, (newPage) => {
    currentConPage = newPage;
    _renderConTable();
  });
}


async function dpContract(id) {
  const res = await fetch(`${API_URL}/api/contracts/${id}`);
  const c   = await res.json();
  if (!c) return;

  _currentContract = c;

  setDPHeader("file-text", "#eef2ff", c.other_party, c.description);

  let validity = '—';
  if (c.validity_type === 'NA') {
    validity = 'No Expiration (NA)';
  } else if (c.validity_type === 'YEAR') {
    validity = c.valid_year || '—';
  } else {
    validity = `${formatDateHuman(c.valid_from)} — ${formatDateHuman(c.valid_to)}`;
  }

  let expiryBadge = "";
  if (c.validity_type === 'NA') {
    expiryBadge = `<span class="badge b-slate">No Expiration</span>`;
  } else {
    const expiryDate = c.validity_type === "YEAR"
      ? new Date(`${c.valid_year}-12-31`)
      : c.valid_to ? new Date(c.valid_to) : null;
    if (expiryDate) {
      const days = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      if (days < 0)       expiryBadge = `<span class="badge b-red">Expired</span>`;
      else if (days <= 30) expiryBadge = `<span class="badge b-amber">Expires in ${days}d</span>`;
      else                 expiryBadge = `<span class="badge b-green">Valid</span>`;
    }
  }

  const statusBadge = _contractStatusLabel(c);

const html = `
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="clipboard-list"></i> Details</div>
      <div class="dp-grid">
        ${dpField("Date",          formatDateHuman(c.contract_date))}
        ${dpField("Other Party",   c.other_party)}
        ${dpField("Description",   c.description)}
        ${dpField("Validity Type", c.validity_type)}
        ${dpField("Validity",      validity)}
        ${dpField("Status",        statusBadge)}
        ${dpField("Expiry Status", expiryBadge)}
      </div>
    </div>

    ${c.remarks ? `<div class="dp-section"><div class="dp-section-hd"><i data-lucide="sticky-note"></i> Remarks</div><div class="dp-grid">${dpFieldFull('Notes', c.remarks)}</div></div>` : ''}
    <div id="contract-actions"></div>
    <div class="dp-section">
      <div class="dp-action-row">${itemHistoryButton('contracts', c.contract_id, c.other_party)}</div>
    </div>`;

  document.getElementById("dp-body").innerHTML = html;

  if (window.lucide) lucide.createIcons();

  renderContractActions(c);
}

async function saveContract() {
  const type = document.getElementById("con-f-type").value;

  const payload = {
    contract_date: document.getElementById("con-f-date").value,
    other_party:   document.getElementById("con-f-party").value,
    description:   document.getElementById("con-f-desc").value,
    validity_type: type,
    valid_year: type === "YEAR"  ? document.getElementById("con-f-year").value : null,
    valid_from: type === "RANGE" ? document.getElementById("con-f-from").value : null,
    valid_to:   type === "RANGE" ? document.getElementById("con-f-to").value   : null,
    remarks:    document.getElementById("con-f-remarks").value
  };

  const url    = window.editContractId ? `${API_URL}/api/contracts/${window.editContractId}` : `${API_URL}/api/contracts`;
  const method = window.editContractId ? "PUT" : "POST";

  // ✅ FIX: backend UPDATE requires `status` — it was never sent, so
  // every edit silently reset status to NULL. Preserve existing value.
  if (window.editContractId) {
    const existing = await fetch(`${API_URL}/api/contracts/${window.editContractId}`).then(r => r.json());
    payload.status = existing?.status || "IN_STORAGE";
  }

  await fetch(url, {
    method,
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });

  showToast("Contract Saved", "t-success");
  addLog(
    window.editContractId ? "UPDATE" : "CREATE",
    "CONTRACT",
    `${window.editContractId ? "Updated" : "Added"} Contract | ${payload.other_party}`,
    window.editContractId || null
  );

  window.editContractId = null;
  closeM("m-add-con");
  renderContracts();
}

async function renderContractActions(c) {
  const el = document.getElementById("contract-actions");
  if (!el) return;

  const isAdmin      = currentUser.role === "admin" || currentUser.role === "super_admin";
  const isSuperAdmin = currentUser.role === "super_admin";

  let buttons = "";
  let statusPillHTML = "";
  let timelineHTML = "";

  try {
    const res = await fetch(`${API_URL}/api/contracts/requests`);
    const allRequests = await res.json();
    // ✅ FIX: every request for this contract, not just "the latest one" —
    // CANCELLED/REJECTED/RETURNED rows are no longer deleted server-side,
    // so this now genuinely reflects the full history.
    const requests = allRequests
      .filter(r => r.contract_id == c.contract_id)
      .sort((a, b) => new Date(b.request_date) - new Date(a.request_date));

    const latestReq = requests[0];
    const currentReq = requests.find(r => r.status === 'PENDING' || r.status === 'APPROVED');

    // ── Status pill: ALWAYS shown, reflects the true latest state ──
    if (latestReq) {
      const meta = _crMeta(latestReq.status);
      statusPillHTML = `
        <div class="dp-status-row">
          <span class="badge ${meta.cls}"><i data-lucide="${meta.icon}"></i> ${meta.label}</span>
          <span class="dp-status-label">Current request status · ${_esc(latestReq.requested_name)}</span>
        </div>`;
    } else {
      statusPillHTML = `
        <div class="dp-status-row">
          <span class="badge b-slate">No requests yet</span>
        </div>`;
    }

    // ── Full timeline — every request cycle, oldest action last ──
    if (requests.length) {
      timelineHTML = `
        <div class="dp-section-hd" style="margin-top:12px;cursor:pointer" onclick="toggleContractRequestTimeline()">
          <i data-lucide="history"></i> Request Timeline (${requests.length}) ${showContractRequestTimeline ? '▲ Hide' : '▼ Show'}
        </div>
        ${showContractRequestTimeline ? `
        <ul class="mh-list">
          ${requests.map(r => {
            const meta = _crMeta(r.status);
            const dateLabel = r.status === 'APPROVED' && r.approved_date
              ? formatDateHuman(r.approved_date)
              : formatDateHuman(r.request_date);
            const who = r.status === 'APPROVED' ? (r.approved_by_name || '—')
                      : r.status === 'REJECTED' ? (r.denied_by_name || '—')
                      : r.requested_name || '—';
            return `
              <li class="mh-item">
                <div class="mh-dot ${r.status === 'APPROVED' ? 'good' : r.status === 'REJECTED' ? 'repair' : 'good'}"></div>
                <div>
                  <div class="mh-cond info"><i data-lucide="${meta.icon}"></i> ${meta.label} — ${_esc(who)}</div>
                  <div class="mh-date">${dateLabel}</div>
                  <div class="mh-remarks">Requested by ${_esc(r.requested_name)}</div>
                </div>
              </li>`;
          }).join('')}
        </ul>` : ''}`;
    }

    // ── Action buttons (same logic as before, unaffected by the fix) ──
    if (!isAdmin) {
      if (!currentReq) {
        buttons = `<button class="btn btn-primary btn-sm" onclick="requestContract(${c.contract_id})"><i data-lucide="send"></i> Request Contract</button>`;
      } else if (currentReq.requested_by !== currentUser.user_id) {
        buttons = `<button class="btn btn-outline btn-sm" disabled><i data-lucide="lock"></i> Requested by ${_esc(currentReq.requested_name)}</button>`;
      } else if (currentReq.status === "PENDING") {
        buttons = `<button class="btn btn-red btn-sm" onclick="cancelRequest(${currentReq.request_id})"><i data-lucide="x-circle"></i> Cancel Request</button>`;
      } else if (currentReq.status === "APPROVED") {
        buttons = `<span class="td-muted" style="font-size:12px"><i data-lucide="check-circle"></i> You currently hold this contract</span>`;
      }
    }

    if (isAdmin) {
      if (currentReq && currentReq.status === "PENDING") {
        buttons = isSuperAdmin
          ? `<button class="btn btn-green btn-sm" onclick="approveRequest(${currentReq.request_id})"><i data-lucide="check"></i> Approve</button>
             <button class="btn btn-red btn-sm" onclick="denyRequest(${currentReq.request_id})"><i data-lucide="x"></i> Deny</button>`
          : `<span class="td-muted" style="font-size:12px"><i data-lucide="clock"></i> Pending — only a Super Admin can approve/deny</span>`;
      }
      if (c.status === "WITH_EMPLOYEE" && currentReq) {
        buttons += `<button class="btn btn-outline btn-sm" onclick="returnContract(${currentReq.request_id})"><i data-lucide="rotate-ccw"></i> Mark as Returned</button>`;
      }
      buttons += `
        <button class="btn btn-primary btn-sm" onclick="editContract(${c.contract_id})"><i data-lucide="pencil"></i> Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteContract(${c.contract_id})"><i data-lucide="trash-2"></i> Delete</button>`;
    }

  } catch (err) {
    console.error(err);
    buttons = "<span class='dp-muted'>Error loading actions</span>";
  }

  el.innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
      ${statusPillHTML}
      <div class="dp-action-row" style="margin-bottom:10px;">
        ${buttons || "<span class='dp-muted'>No actions available</span>"}
      </div>
      ${timelineHTML}
    </div>`;

  if (window.lucide) lucide.createIcons();
}

async function editContract(id) {
  const res = await fetch(`${API_URL}/api/contracts/${id}`);
  const c = await res.json();
  if (!c) return;

  openM("m-add-con");
  const title = document.querySelector('#m-add-con .modal-title');
  if (title) title.innerHTML = `<i data-lucide="file-text"></i> Edit Contract`;
  if (window.lucide) lucide.createIcons();

  // ✅ FIX: no fetch dependency here — set values directly, no timeout needed
  document.getElementById("con-f-date").value  = formatDateForInput(c.contract_date);
  document.getElementById("con-f-party").value = c.other_party     || "";
  document.getElementById("con-f-desc").value  = c.description     || "";
  document.getElementById("con-f-type").value  = c.validity_type   || "YEAR";
  toggleValidity();

  document.getElementById("con-f-year").value  = c.valid_year || "";
  document.getElementById("con-f-from").value  = formatDateForInput(c.valid_from);
  document.getElementById("con-f-to").value    = formatDateForInput(c.valid_to);
  document.getElementById("con-f-remarks").value = c.remarks  || "";

  window.editContractId = id;
}

// ✅ NEW: resets title + editContractId when opening a fresh Add form
function openAddContract() {
  window.editContractId = null;
  const title = document.querySelector('#m-add-con .modal-title');
  if (title) title.innerHTML = `<i data-lucide="file-text"></i> Add Contract`;
  if (window.lucide) lucide.createIcons();
  openM("m-add-con");
}

function deleteContract(id) {
  deleteContractId = id;
  openM("m-confirm-con-del");
}

function confirmDeleteContract() {

  fetch(`${API_URL}/api/contracts/${deleteContractId}`)
    .then(res => res.json())
    .then(c => {

      return fetch(`${API_URL}/api/contracts/${deleteContractId}`, {
        method: "DELETE"
      }).then(() => c);
    })
    .then(c => {

      addLog(
        "DELETE",
        "CONTRACT",
        `Deleted Contract | ${c.other_party}`,
        deleteContractId
      );

      showToast("Contract Deleted", "t-warning");

      closeM("m-confirm-con-del");
      closeDP();
      renderContracts();
    });
}
function requestContract(id) {
  fetch(`${API_URL}/api/contracts/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contract_id: id, user_id: currentUser.user_id })
  })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    showToast("Contract request sent", "t-success");
    addLog("REQUEST", "CONTRACT",
      `Requested contract | ${_currentContract?.other_party || id}`, id);
    refreshContractUI(id); // ✅ FIX: unified refresh (table + open DP)
  })
  .catch(err => showToast(err.message || "Request failed", "t-error"));
}

function approveRequest(id) {
  fetch(`${API_URL}/api/contracts/request/${id}/approve`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_id: currentUser.user_id })
  })
  .then(res => {
    // ✅ FIX: was ignoring failed responses entirely — a 403 (non-super-admin)
    // or 400 (already processed) previously still showed "Contract approved".
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    showToast("Contract approved", "t-success");
    addLog("REQUEST", "CONTRACT",
      `Approved request | ${_currentContract?.other_party || id}`, id);
    refreshContractUI(dpCurrentId); // ✅ FIX: unified refresh
  })
  .catch(err => showToast(err.message || "Approve failed", "t-error"));
}

function returnContract(id) {
  fetch(`${API_URL}/api/contracts/request/${id}/return`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: currentUser.user_id,
      performed_by: currentUser.name,
    }),
  })
    .then(res => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
      showToast("Contract returned", "t-success");
      addLog("REQUEST", "CONTRACT",
        `Returned contract | ${_currentContract?.other_party || id}`, id);
      refreshContractUI(dpCurrentId);
    })
    .catch(err => showToast(err.message || "Return failed", "t-error"));
}

function cancelRequest(id) {
  fetch(`${API_URL}/api/contracts/request/${id}`, { method: "DELETE" })
    .then(res => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
      showToast("Request cancelled", "t-warning");
      addLog("REQUEST", "CONTRACT",
        `Cancelled request | ${_currentContract?.other_party || id}`, id);
      refreshContractUI(dpCurrentId); // ✅ FIX: also refresh the table, not just the DP
    })
    .catch(err => showToast(err.message || "Cancel failed", "t-error"));
}

function denyRequest(id) {
  fetch(`${API_URL}/api/contracts/request/${id}/deny`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    // ✅ FIX (Change 3): previously sent NO body — the backend now requires
    // admin_id to verify super_admin role server-side.
    body: JSON.stringify({ admin_id: currentUser.user_id })
  })
    .then(res => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
      showToast("Request denied", "t-warning");
      addLog("REQUEST", "CONTRACT",
        `Denied request | ${_currentContract?.other_party || id}`, id);
      refreshContractUI(dpCurrentId); // ✅ FIX: unified refresh
    })
    .catch(err => showToast(err.message || "Deny failed", "t-error"));
}

function toggleValidity() {
  const type = document.getElementById("con-f-type").value;

  // Show/hide year field
  const yearEl = document.getElementById("con-year");
  if (yearEl) yearEl.style.display = type === "YEAR" ? "block" : "none";

  // Show/hide range fields
  const rangeEl  = document.getElementById("con-range");
  const range2El = document.getElementById("con-range2");
  if (rangeEl)  rangeEl.style.display  = type === "RANGE" ? "block" : "none";
  if (range2El) range2El.style.display = type === "RANGE" ? "block" : "none";

  // ✅ Show NA notice
  const naNotice = document.getElementById("con-na-notice");
  if (naNotice) naNotice.style.display = type === "NA" ? "block" : "none";
}


let _contractRefreshInFlight = false;
 
async function refreshContractUI(id = null) {
  _contractRefreshInFlight = true;
  try {
    await renderContracts();
    if (dpCurrentType === "contracts" && (id || dpCurrentId)) {
      await dpContract(id || dpCurrentId);
    }
  } finally {
    _contractRefreshInFlight = false;
  }
}
 

const CONTRACT_REQ_STATUS_META = {
  PENDING:   { icon: 'clock', label: 'Pending',   cls: 'b-amber' },
  APPROVED:  { icon: 'check', label: 'Approved',  cls: 'b-green' },
  REJECTED:  { icon: 'x', label: 'Denied',    cls: 'b-red'   },
  CANCELLED: { icon: 'x-circle', label: 'Cancelled', cls: 'b-slate' },
  RETURNED:  { icon: 'rotate-ccw', label: 'Returned',  cls: 'b-blue'  },
};

// ✅ NEW: request timeline is now collapsible (default collapsed — the
// status pill above already shows the current state at a glance; the
// full timeline is opt-in detail).
let showContractRequestTimeline = false;

function toggleContractRequestTimeline() {
  showContractRequestTimeline = !showContractRequestTimeline;
  if (dpOpen && dpCurrentType === 'contracts') renderContractActions(_currentContract);
}

function _crMeta(status) {
  return CONTRACT_REQ_STATUS_META[status] || { icon: 'circle', label: status || '—', cls: 'b-slate' };
}


if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.contracts = dpContract;