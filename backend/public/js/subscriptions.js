/* ============================================================
   subscriptions_unified.js  —  SECOND PASS
   
   New in this version:
   • Search bar support for unified table
   • Pagination (20/page) for unified table
   • Filters: Source, Status, Category
   • Attachment panel collapsible by default (already in v1,
     but now open=false enforced)
   • FILE SIZE LIMIT constant documented
   • All null-safety improvements
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   SHARED HELPERS
────────────────────────────────────────────────────────── */

async function fetchOne(module, id) {
  const apiMap = { m365: 'm365', globe: 'globe', subscriptions: 'subscriptions' };
  const endpoint = apiMap[module] || module;
  const res = await fetch(`${API_URL}/api/${endpoint}/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch ${module} #${id}`);
  return res.json();
}

function statusBadge(status) {
  const map = {
    'Active':        'b-green',
    'Licensed':      'b-green',
    'No License':    'b-red',
    'For Renewal':   'b-amber',
    'Expiring Soon': 'b-amber',
    'Expired':       'b-red',
    'Inactive':      'b-slate',
    'Cancelled':     'b-slate',
  };
  return `<span class="badge ${map[status] || 'b-slate'}">${status || '—'}</span>`;
}

function _dpEsc(str) {
  if (!str) return '—';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtCost(val) {
  if (val == null || val === '') return '—';
  return '₱' + Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

/* ──────────────────────────────────────────────────────────
   UNIFIED TABLE STATE
────────────────────────────────────────────────────────── */
const UNI_PAGE_SIZE = 20;
let uniCurrentPage  = 1;
let uniSearchQuery  = '';
let _uniAllRows     = [];

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('uni-search');
  if (input) {
    input.addEventListener('input', () => {
      uniSearchQuery = input.value.trim().toLowerCase();
      uniCurrentPage = 1;
      _renderUniTable();
    });
  }
});

/* ──────────────────────────────────────────────────────────
   UNIFIED TABLE — renderSubscriptionsUnified()
────────────────────────────────────────────────────────── */

async function renderSubscriptionsUnified() {
  const [m365Data, globeData, subData] = await Promise.all([
    fetch(`${API_URL}/api/m365`).then(r => r.json()).catch(() => []),
    fetch(`${API_URL}/api/globe`).then(r => r.json()).catch(() => []),
    fetch(`${API_URL}/api/subscriptions`).then(r => r.json()).catch(() => []),
  ]);
  const sourceFilter   = document.getElementById('uni-filter-source')?.value   || 'all';
  const statusFilter   = document.getElementById('uni-filter-status')?.value   || 'all';
  const assignedFilter = document.getElementById('uni-filter-assigned')?.value || 'all';

  let rows = [];

  if (sourceFilter === 'all' || sourceFilter === 'M365') {
    m365Data.forEach(m => {
      rows.push({
        source: 'M365', id: m.license_id,
        name: m.assigned_email || 'M365 License',
        assignedTo: m.assigned_user_name || 'Unassigned',
        supplier: 'Microsoft',
        category: m.license_type || '—',
        cost: m.monthly_cost ?? m.license_cost,
        expiry: m.renewal_date,          // ✅ renewal-only now
        status: m.computed_status,       // "Licensed" / "No License"
        renewalAlert: m.renewal_alert_active,
        _raw: m,
      });
    });
  }

  if (sourceFilter === 'all' || sourceFilter === 'Globe') {
    globeData.forEach(g => {
      rows.push({
        source: 'Globe', id: g.plan_id,
        name: g.plan_name || 'Globe Plan',
        assignedTo: g.employee_name || 'Unassigned',
        supplier: 'Globe Telecom',
        category: 'Telecom',
        cost: g.monthly_cost,
        expiry: g.renewal_date,
        status: g.computed_status,       // ✅ trusts stored status directly (backend fix)
        renewalAlert: g.renewal_alert_active,
        _raw: g,
      });
    });
  }

  if (sourceFilter === 'all' || sourceFilter === 'Other') {
    subData.forEach(s => {
      rows.push({
        source: 'Other', id: s.subscription_id,
        name: s.subscription_name || '—',
        assignedTo: s.assigned_to || s.assigned_user_name || '—',
        supplier: s.supplier || '—',
        category: s.category || '—',
        cost: s.monthly_cost,
        expiry: s.renewal_date,          // ✅ renewal-only now
        status: s.computed_status,
        renewalAlert: s.renewal_alert_active,
        _raw: s,
      });
    });
  }

  if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
  if (assignedFilter !== 'all') {
    const isUnassigned = r => !r.assignedTo || r.assignedTo === 'Unassigned' || r.assignedTo === '—';
    rows = assignedFilter === 'assigned'
      ? rows.filter(r => !isUnassigned(r))
      : rows.filter(r => isUnassigned(r));
  }

  const total    = rows.length;
  const active   = rows.filter(r => r.status === 'Active' || r.status === 'Licensed').length;
  const expiring = rows.filter(r => r.status === 'For Renewal' || r.status === 'Expiring Soon' || r.renewalAlert).length;
  const expired  = rows.filter(r => r.status === 'Expired' || r.status === 'No License').length;
  const totalCost = rows.filter(r => (r.status === 'Active' || r.status === 'Licensed') && r.cost != null)
    .reduce((s, r) => s + Number(r.cost), 0);

  _setTxt('uni-stat-total',    total);
  _setTxt('uni-stat-active',   active);
  _setTxt('uni-stat-expiring', expiring);
  _setTxt('uni-stat-expired',  expired);
  _setTxt('uni-total-cost',    `Total active monthly: ${fmtCost(totalCost)}`);

  _uniAllRows    = rows;
  uniCurrentPage = 1;
  _renderUniTable();
}

function _renderUniTable() {
  // Apply search
  let rows = _uniAllRows;
  if (uniSearchQuery) {
    rows = rows.filter(r =>
      r.name.toLowerCase().includes(uniSearchQuery) ||
      r.assignedTo.toLowerCase().includes(uniSearchQuery) ||
      r.supplier.toLowerCase().includes(uniSearchQuery) ||
      r.category.toLowerCase().includes(uniSearchQuery)
    );
  }

  const total = rows.length;
  const start = (uniCurrentPage - 1) * UNI_PAGE_SIZE;
  const page  = rows.slice(start, start + UNI_PAGE_SIZE);

  // ✅ FIX (Subscription_Total_Count_Fix): "total" was only recomputed by
  // renderSubscriptionsUnified() (fired by the dropdown filters) — the
  // search box only ever called this function, so the count silently
  // went stale while searching. Now it's kept in sync here too.
  _setTxt('uni-stat-total', total);

  const tbody = document.getElementById('uni-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--slate-400)">No subscriptions found.</td></tr>`;
  } else {
    const sourceColors = { M365: 'b-blue', Globe: 'b-green', Other: 'b-purple' };
    page.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'tr-clickable';
      tr.innerHTML = `
        <td><span class="badge ${sourceColors[row.source] || 'b-slate'}">${row.source}</span></td>
        <td class="td-strong">${row.name}</td>
        <td>${row.assignedTo}</td>
        <td>${row.supplier}</td>
        <td>${fmtCost(row.cost)}</td>
        <td>${fmtDate(row.expiry)}</td>
        <td>${statusBadge(row.status)}</td>
      `;
      tr.addEventListener('click', () => {
        const typeMap = { M365: 'm365', Globe: 'globe', Other: 'subscriptions' };
        openDP(typeMap[row.source], row.id, tr);
      });
      tbody.appendChild(tr);
    });
  }

  _renderUniPagination(total);
}

// ✅ CHANGED: now delegates to the shared sliding-window pagination helper
function _renderUniPagination(total) {
  renderPaginationControls('uni-pagination', total, UNI_PAGE_SIZE, uniCurrentPage, (newPage) => {
    uniCurrentPage = newPage;
    _renderUniTable();
  });
}

function _setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ──────────────────────────────────────────────────────────
   ADD FLOW — type selector modal
────────────────────────────────────────────────────────── */

function openAddSubscription() {
  openM('m-sub-type-select');
}

function selectSubType(type) {
  closeM('m-sub-type-select');
  if (type === 'M365') {
    m365EditId = null;
    openM('m-add-m365');
    loadM365Users();   // ✅ NEW
  } else if (type === 'Globe') {
    globeEditId = null;
    openM('m-add-globe');
    loadGlobeUsers();
  } else {
    subEditId = null;
    openM('m-sub-add');
    const intervalEl = document.getElementById('sub-f-interval');
    if (intervalEl) intervalEl.value = 1;
    _toggleSubIntervalField();
  }
}

/* ──────────────────────────────────────────────────────────
   M365 LICENSES
────────────────────────────────────────────────────────── */

let m365EditId = null;

async function renderM365() {
  try {
    const data  = await (await fetch(`${API_URL}/api/m365`)).json();
    const tbody = document.getElementById('m365-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      let noLicenseCount = 0;
      data.forEach(m => {
        const status = m.computed_status;
        if (status === 'No License') noLicenseCount++;
        const tr = document.createElement('tr');
        tr.className = 'tr-clickable';
        tr.innerHTML = `
          <td>${m.assigned_email || '—'}</td>
          <td>${m.license_type  || '—'}</td>
          <td>${fmtDate(m.renewal_date)}</td>
          <td>${fmtCost(m.monthly_cost ?? m.license_cost)}</td>
          <td>${statusBadge(status)}</td>
          <td><div class="flex-gap">
            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editM365(${m.license_id})"><i data-lucide="pencil"></i></button>
            <button class="btn btn-xs btn-red"     onclick="event.stopPropagation();deleteM365Prompt(${m.license_id})"><i data-lucide="trash-2"></i></button>
          </div></td>`;
        tr.addEventListener('click', () => openDP('m365', m.license_id, tr));
        tbody.appendChild(tr);
      });
      _setTxt('m365-exp-ct', `${noLicenseCount} no license`);
      _setTxt('m365-ct',     `${data.length} licenses`);

      if (window.lucide) lucide.createIcons();
    }
    renderSubscriptionsUnified();
  } catch (err) {
    console.error('renderM365:', err);
    showToast('Failed to load M365 licenses', 't-error');
  }
}

async function dpM365(id) {
  try {
    const m      = await fetchOne('m365', id);
    const status = m.computed_status;
    setDPHeader('app-window', '#f0f9ff', m.assigned_email || '—', 'M365 License');
    const html = `
      <div class="dp-status-row">${statusBadge(status)}<span class="dp-status-label">License status</span></div>
      <div class="dp-section">
        <div class="dp-section-hd"><i data-lucide="mail"></i> License Info</div>
        <div class="dp-grid">
          ${dpField('Assigned Email', m.assigned_email || '—')}
          ${dpField('Assigned User',  m.assigned_user_name || 'Unassigned')}
          ${dpField('License Type',   m.license_type  || '—')}
          ${dpField('Cost',   fmtCost(m.monthly_cost ?? m.license_cost))}
        </div>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd"><i data-lucide="calendar"></i> Renewal (Yearly)</div>
        <div class="dp-grid">
          ${dpField('Renewal Date', fmtDate(m.renewal_date))}
          ${dpField('Next Renewal', fmtDate(m.next_renewal_date))}
          ${m.renewal_alert_active ? dpField('Alert', '<span class="badge b-amber"><i data-lucide="triangle-alert"></i> Renewal window (within 3 days)</span>') : ''}
        </div>
      </div>
      ${m.remarks ? `<div class="dp-section"><div class="dp-section-hd"><i data-lucide="sticky-note"></i> Remarks</div><div class="dp-grid">${dpFieldFull('Notes', m.remarks)}</div></div>` : ''}
      <div class="dp-section" id="dp-att-m365-${id}"></div>
      <div class="dp-section">
        <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
        <div class="dp-action-row">
          ${isAdminUser() ? `
            <button class="btn btn-primary btn-sm" onclick="editM365(${m.license_id})"><i data-lucide="pencil"></i> Edit</button>
            <button class="btn btn-red btn-sm"     onclick="deleteM365Prompt(${m.license_id})"><i data-lucide="trash-2"></i> Delete</button>
          ` : ''}
          ${itemHistoryButton('m365', m.license_id, m.assigned_email)}
        </div>
      </div>`;
    document.getElementById('dp-body').innerHTML = html;
    document.getElementById('dp-footer').style.display = 'none';

    if (window.lucide) lucide.createIcons();

    attachmentPanel('m365', id, `dp-att-m365-${id}`);
  } catch (err) { showToast('Failed to load license', 't-error'); }
}

function saveM365() {
  const email     = document.getElementById('m365-f-email').value.trim();
  const type      = document.getElementById('m365-f-type').value;
  const licensed  = document.getElementById('m365-f-licensed').value === 'true';
  const renewal   = document.getElementById('m365-f-renew').value;
  const cost      = parseFloat(document.getElementById('m365-f-cost').value) || null;
  const remarks   = document.getElementById('m365-f-remarks').value;

  const assignedName = document.getElementById('m365-f-assigned').value.trim();
  const assigned_user_id = assignedName ? (m365UserMap[assignedName] || null) : null;

  if (!email || !type) { showToast('Email and license type are required', 't-error'); return; }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) { showToast('Invalid email format', 't-error'); return; }
  if (assignedName && !assigned_user_id) { showToast('Select a valid user or clear the field', 't-error'); return; }
  if (!renewal) { showToast('Renewal date is required', 't-error'); return; }

  const payload = {
    assigned_email: email, license_type: type, licensed, assigned_user_id,
    monthly_cost: cost, renewal_date: renewal, remarks,
    user_id: currentUser.user_id,
    performed_by: currentUser.name,
  };

  const url = m365EditId ? `${API_URL}/api/m365/${m365EditId}` : `${API_URL}/api/m365`;
  fetch(url, { method: m365EditId ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); return r.json(); })
    .then(() => {
      showToast(m365EditId ? 'License updated' : 'License added', 't-success');
      addLog(m365EditId ? 'UPDATE' : 'CREATE', 'M365 LICENSE', `${m365EditId ? 'Updated' : 'Added'} M365 license: ${email}`, null);
      m365EditId = null;
      closeM('m-add-m365');
      renderM365();
    })
    .catch(err => showToast(err.message || 'Failed to save license', 't-error'));
}


async function editM365(id) {
  try {
    const m = await fetchOne('m365', id);
    m365EditId = id;
    document.getElementById('m365-f-email').value     = m.assigned_email || '';
    document.getElementById('m365-f-type').value      = m.license_type   || '';
    document.getElementById('m365-f-licensed').value  = m.licensed === false ? 'false' : 'true';
    document.getElementById('m365-f-cost').value      = m.monthly_cost ?? m.license_cost ?? '';
    document.getElementById('m365-f-remarks').value   = m.remarks        || '';
    document.getElementById('m365-f-renew').value     = m.renewal_date ? new Date(m.renewal_date).toISOString().slice(0,10) : '';

    await loadM365Users();
    document.getElementById('m365-f-assigned').value = m.assigned_user_name || '';
    selectState['m365-f-assigned'] = !!m.assigned_user_name;

    openM('m-add-m365');
  } catch { showToast('Failed to load license for editing', 't-error'); }
}
// ✅ NEW: loads the user list for the Assigned To searchable field, mirrors loadGlobeUsers()
let m365UserMap = {};
async function loadM365Users() {
  const res   = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();
  const names = users.map(u => u.name);
  makeSearchable('m365-f-assigned', 'm365-f-assigned-list', names);
  m365UserMap = {};
  users.forEach(u => { m365UserMap[u.name] = u.user_id; });
}


/* ──────────────────────────────────────────────────────────
   GLOBE MOBILE PLANS
────────────────────────────────────────────────────────── */

let globeEditId = null;
let globeUserMap = {};

async function renderGlobe() {
  try {
    const data  = await (await fetch(`${API_URL}/api/globe`)).json();
    const tbody = document.getElementById('globe-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      let renewSoon = 0;
      data.forEach(g => {
        const status = g.computed_status || g.status;
        if (status === 'For Renewal') renewSoon++;
        const tr = document.createElement('tr');
        tr.className = 'tr-clickable';
        tr.innerHTML = `
          <td>${g.employee_name || '<span class="badge b-slate">Unassigned</span>'}</td>
          <td>${g.mobile_number  || '—'}</td>
          <td>${g.plan_name      || '—'}</td>
          <td>${fmtCost(g.monthly_cost)}</td>
          <td>${fmtDate(g.renewal_date)}</td>
          <td>${statusBadge(status)}</td>
          <td><div class="flex-gap">
            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editGlobe(${g.plan_id})"><i data-lucide="pencil"></i></button>
            <button class="btn btn-xs btn-red"     onclick="event.stopPropagation();deleteGlobePrompt(${g.plan_id})"><i data-lucide="trash-2"></i></button>
          </div></td>`;
        tr.addEventListener('click', () => openDP('globe', g.plan_id, tr));
        tbody.appendChild(tr);
      });
      _setTxt('globe-renew-ct', `${renewSoon} renewing soon`);
      _setTxt('globe-ct',       `${data.length} plans`);

      if (window.lucide) lucide.createIcons();
    }
    renderSubscriptionsUnified();
  } catch (err) { console.error('renderGlobe:', err); showToast('Failed to load Globe plans', 't-error'); }
}

async function dpGlobe(id) {
  try {
    const g      = await fetchOne('globe', id);
    const status = g.computed_status;
setDPHeader('smartphone', '#f0fdf4', g.employee_name || '—', 'Globe Mobile Plan');
    const html = `
      <div class="dp-status-row">${statusBadge(status)}<span class="dp-status-label">Plan status</span></div>
      <div class="dp-section">
        <div class="dp-section-hd"><i data-lucide="user"></i> Subscriber</div>
        <div class="dp-grid">
          ${dpField('Employee',   g.employee_name || '<span class="badge b-slate">Unassigned</span>')}
          ${dpField('Mobile No.', g.mobile_number  || '—')}
          ${dpField('Account No.',g.account_number || '—')}
        </div>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd"><i data-lucide="smartphone"></i> Plan Details</div>
        <div class="dp-grid">
          ${dpField('Plan Name',    g.plan_name      || '—')}
          ${dpField('Cost', fmtCost(g.monthly_cost))}
          ${dpField('Data',         g.data_allocation|| '—')}
          ${dpField('Credit Limit', fmtCost(g.credit_limit))}
          ${dpField('Renewal Date', fmtDate(g.renewal_date))}
          ${dpField('Next Renewal', fmtDate(g.next_renewal_date))}
          ${g.renewal_alert_active ? dpField('Alert', '<span class="badge b-amber"><i data-lucide="triangle-alert"></i> Renewal window (within 3 days)</span>') : ''}
        </div>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd"><i data-lucide="gift"></i> Plan Inclusions</div>
        <div class="dp-grid">
          ${dpField('Unli All-Net Calls', g.unli_allnet_calls ? '<span class="badge b-green">Included</span>' : '<span class="badge b-slate">Not Included</span>')}
          ${dpField('Unli Text', g.unli_text ? '<span class="badge b-green">Included</span>' : '<span class="badge b-slate">Not Included</span>')}
          ${dpField('Data Allocation', g.data_allocation || null)}
          ${dpFieldFull('Freebie', g.freebie || null)}
        </div>
      </div>
      ${g.remarks ? `<div class="dp-section"><div class="dp-section-hd"><i data-lucide="sticky-note"></i> Remarks</div><div class="dp-grid">${dpFieldFull('Notes', g.remarks)}</div></div>` : ''}
      <div class="dp-section" id="dp-att-globe-${id}"></div>
      <div class="dp-section">
        <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
        <div class="dp-action-row">
          <button class="btn btn-primary btn-sm" onclick="editGlobe(${g.plan_id})"><i data-lucide="pencil"></i> Edit</button>
          <button class="btn btn-red btn-sm"     onclick="deleteGlobePrompt(${g.plan_id})"><i data-lucide="trash-2"></i> Delete</button>
          ${itemHistoryButton('globe', g.plan_id, g.employee_name || g.plan_name)}
        </div>
      </div>`;
    document.getElementById('dp-body').innerHTML = html;
    document.getElementById('dp-footer').style.display = 'none';

    if (window.lucide) lucide.createIcons();

    attachmentPanel('globe', id, `dp-att-globe-${id}`);
  } catch (err) { showToast('Failed to load Globe plan', 't-error'); }
}


function saveGlobe() {
  const userName = document.getElementById('globe-f-user').value;
  const mobile   = document.getElementById('globe-f-num').value.trim();
  const plan     = document.getElementById('globe-f-plan').value.trim();
  const renew    = document.getElementById('globe-f-renew').value;

  if (!mobile || !plan || !renew) { showToast('Mobile number, plan name, and renewal date are required', 't-error'); return; }
  // ✅ CHANGED (Globe_Unassigned_Support): Employee is now optional —
  // only validate it if something was actually typed.
  if (userName && !selectState['globe-f-user']) { showToast('Select a valid employee from the list, or leave blank for Unassigned', 't-error'); return; }
  const mobilePattern = /^09\d{2}-\d{3}-\d{4}$/;
  if (!mobilePattern.test(mobile)) { showToast('Invalid mobile format (e.g. 0917-123-4567)', 't-error'); return; }

  const payload = {
    user_id:        userName ? (globeUserMap[userName] || null) : null,
    mobile_number:  mobile,
    account_number: document.getElementById('globe-f-acct').value,
    plan_name:      plan,
    data_allocation:document.getElementById('globe-f-data').value,
    monthly_cost:   document.getElementById('globe-f-cost').value   || null,
    credit_limit:   document.getElementById('globe-f-credit').value || null,
    renewal_date:   renew,
    status:         document.getElementById('globe-f-status').value,
    remarks:        document.getElementById('globe-f-remarks').value,
    unli_allnet_calls: document.getElementById('globe-f-unli-calls').value === 'true',
    unli_text:         document.getElementById('globe-f-unli-text').value === 'true',
    freebie:            document.getElementById('globe-f-freebie').value.trim() || null,
    performed_by: currentUser.name,
    admin_id: currentUser.user_id,
  };

  const url = globeEditId ? `${API_URL}/api/globe/${globeEditId}` : `${API_URL}/api/globe`;
  fetch(url, { method: globeEditId ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); return r.json(); })
    .then(record => {
      showToast(globeEditId ? 'Plan updated' : 'Plan added', 't-success');
      addLog(globeEditId ? 'UPDATE' : 'CREATE', 'GLOBE PLAN', `${globeEditId ? 'Updated' : 'Added'} Globe plan for ${userName}`, record.plan_id);
      globeEditId = null;
      closeM('m-add-globe');
      renderGlobe();
    })
    .catch(err => showToast(err.message || 'Failed to save plan', 't-error'));
}

async function editGlobe(id) {
  try {
    const g = await fetchOne('globe', id);
    globeEditId = id;
    await loadGlobeUsers();
    document.getElementById('globe-f-user').value    = g.employee_name  || '';
    selectState['globe-f-user'] = !!g.employee_name;
    document.getElementById('globe-f-num').value     = g.mobile_number  || '';
    document.getElementById('globe-f-acct').value    = g.account_number || '';
    document.getElementById('globe-f-plan').value    = g.plan_name      || '';
    document.getElementById('globe-f-cost').value    = g.monthly_cost   || '';
    document.getElementById('globe-f-data').value    = g.data_allocation|| '';
    document.getElementById('globe-f-credit').value  = g.credit_limit   || '';
    document.getElementById('globe-f-remarks').value = g.remarks        || '';
    document.getElementById('globe-f-status').value  = g.status         || 'Active';
    document.getElementById('globe-f-renew').value   = g.renewal_date ? new Date(g.renewal_date).toISOString().slice(0,10) : '';
    document.getElementById('globe-f-unli-calls').value = g.unli_allnet_calls ? 'true' : 'false';
    document.getElementById('globe-f-unli-text').value  = g.unli_text ? 'true' : 'false';
    document.getElementById('globe-f-freebie').value    = g.freebie || '';
    openM('m-add-globe');
  } catch { showToast('Failed to load plan for editing', 't-error'); }
}


async function loadGlobeUsers() {
  const res   = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();
  const names = users.map(u => u.name);
  makeSearchable('globe-f-user', 'globe-f-user-list', names);
  globeUserMap = {};
  users.forEach(u => { globeUserMap[u.name] = u.user_id; });
}

function openAddGlobe() { globeEditId = null; openM('m-add-globe'); loadGlobeUsers(); }

// ✅ NEW: auto-formats mobile number input as the user types, so they can just type
// digits (09276485673) instead of manually typing dashes (0917-123-4567).
function formatGlobeMobileInput(el) {
  const digits = el.value.replace(/\D/g, '').slice(0, 11); // keep digits only, max 11
  let formatted = digits;
  if (digits.length > 7) {
    formatted = `${digits.slice(0,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  } else if (digits.length > 4) {
    formatted = `${digits.slice(0,4)}-${digits.slice(4)}`;
  }
  el.value = formatted;
}

/* ──────────────────────────────────────────────────────────
   OTHER SUBSCRIPTIONS
────────────────────────────────────────────────────────── */

let subEditId = null;

async function renderSubscriptions() {
  try {
    const data  = await (await fetch(`${API_URL}/api/subscriptions`)).json();
    const tbody = document.getElementById('sub-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      data.forEach(s => {
        const status = s.computed_status;
        const tr = document.createElement('tr');
        tr.className = 'tr-clickable';
        tr.innerHTML = `
          <td>${s.subscription_name || '—'}</td>
          <td>${s.category          || '—'}</td>
          <td>${s.assigned_to || s.assigned_user_name || '—'}</td>
          <td>${s.supplier          || '—'}</td>
          <td>${fmtCost(s.monthly_cost)}</td>
          <td>${fmtDate(s.renewal_date)}</td>
          <td>${statusBadge(status)}</td>
          <td><div class="flex-gap">
            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editSubscription(${s.subscription_id})"><i data-lucide="pencil"></i></button>
            <button class="btn btn-xs btn-red"     onclick="event.stopPropagation();deleteSubPrompt(${s.subscription_id})"><i data-lucide="trash-2"></i></button>
          </div></td>`;
        tr.addEventListener('click', () => openDP('subscriptions', s.subscription_id, tr));
        tbody.appendChild(tr);
      });

      // ✅ NEW: renders the Edit/Delete icons injected into table rows above
      if (window.lucide) lucide.createIcons();
    }
    renderSubscriptionsUnified();
  } catch (err) { console.error('renderSubscriptions:', err); showToast('Failed to load subscriptions', 't-error'); }
}

async function dpSubscriptions(id) {
  try {
    const s      = await fetchOne('subscriptions', id);
    const status = s.computed_status;
    setDPHeader('🔐', '#fdf4ff', s.subscription_name || '—', s.category || '—');
    const html = `
      <div class="dp-status-row">${statusBadge(status)}<span class="dp-status-label">Subscription status</span></div>
      <div class="dp-section">
        <div class="dp-section-hd">📋 Details</div>
        <div class="dp-grid">
          ${dpField('Name',        s.subscription_name || '—')}
          ${dpField('Category',    s.category          || '—')}
          ${dpField('Supplier',    s.supplier          || '—')}
          ${dpField('Assigned To', s.assigned_user_name || s.assigned_to || '—')}
          ${dpField('Cost',fmtCost(s.monthly_cost))}
          ${dpField('Billing',     s.billing_cycle_label || s.billing_cycle || '—')}
        </div>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd">📅 Renewal</div>
        <div class="dp-grid">
          ${dpField('Renewal Date', fmtDate(s.renewal_date))}
          ${s.billing_cycle !== 'one-time' ? dpField('Next Renewal', fmtDate(s.next_renewal_date)) : ''}
          ${s.renewal_alert_active ? dpField('Alert', '<span class="badge b-amber">⚠️ Renewal window (within 3 days)</span>') : ''}
        </div>
      </div>
      ${s.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', s.remarks)}</div></div>` : ''}
      <div class="dp-section" id="dp-att-sub-${id}"></div>
      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
          ${isAdminUser() ? `
            <button class="btn btn-primary btn-sm" onclick="editSubscription(${s.subscription_id})">✏️ Edit</button>
            <button class="btn btn-red btn-sm"     onclick="deleteSubPrompt(${s.subscription_id})">🗑️ Delete</button>
          ` : ''}
          ${itemHistoryButton('subscriptions', s.subscription_id, s.subscription_name)}
        </div>
      </div>`;
    document.getElementById('dp-body').innerHTML = html;
    document.getElementById('dp-footer').style.display = 'none';
    attachmentPanel('subscriptions', id, `dp-att-sub-${id}`);
  } catch (err) { showToast('Failed to load subscription', 't-error'); }
}

function _toggleSubIntervalField() {
  const cycle = document.getElementById('sub-f-cycle')?.value;
  const row   = document.getElementById('sub-f-interval-row');
  if (row) row.style.display = (cycle === 'one-time') ? 'none' : 'flex';
}

function saveSubscription() {
  const name     = document.getElementById('sub-f-name').value.trim();
  const category = document.getElementById('sub-f-cat').value;
  const renewal  = document.getElementById('sub-f-renew').value;
  const cycle    = document.getElementById('sub-f-cycle').value;
  const interval = parseInt(document.getElementById('sub-f-interval')?.value) || 1;
  if (!name || !category) { showToast('Subscription name and category are required', 't-error'); return; }
  if (cycle !== 'one-time' && interval < 1) { showToast('Interval must be at least 1', 't-error'); return; }

  const payload = {
    subscription_name: name,
    category,
    supplier:      document.getElementById('sub-f-supplier').value.trim() || null,
    assigned_to:   document.getElementById('sub-f-assigned').value.trim() || null,
    monthly_cost:  document.getElementById('sub-f-cost').value    || null,
    billing_cycle: cycle,
    billing_interval: cycle === 'one-time' ? 1 : interval, // ✅ NEW
    renewal_date:  renewal || null,
    status:        document.getElementById('sub-f-status').value,
    remarks:       document.getElementById('sub-f-remarks').value,
    performed_by:  currentUser.name,
  };

  const url = subEditId ? `${API_URL}/api/subscriptions/${subEditId}` : `${API_URL}/api/subscriptions`;
  fetch(url, { method: subEditId ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); return r.json(); })
    .then(record => {
      showToast(subEditId ? 'Subscription updated' : 'Subscription added', 't-success');
      addLog(subEditId ? 'UPDATE' : 'CREATE', 'SUBSCRIPTION', `${subEditId ? 'Updated' : 'Added'} subscription: ${name}`, record.subscription_id);
      subEditId = null;
      closeM('m-sub-add');
      renderSubscriptions();
    })
    .catch(err => showToast(err.message || 'Failed to save subscription', 't-error'));
}


async function editSubscription(id) {
  try {
    const s = await fetchOne('subscriptions', id);
    subEditId = id;
    document.getElementById('sub-f-name').value     = s.subscription_name || '';
    document.getElementById('sub-f-cat').value      = s.category          || '';
    document.getElementById('sub-f-supplier').value = s.supplier          || '';
    document.getElementById('sub-f-assigned').value = s.assigned_to       || s.assigned_user_name || '';
    document.getElementById('sub-f-cost').value     = s.monthly_cost      || '';
    document.getElementById('sub-f-cycle').value    = s.billing_cycle     || 'monthly';
    const intervalEl = document.getElementById('sub-f-interval');
    if (intervalEl) intervalEl.value = s.billing_interval || 1;
    _toggleSubIntervalField();
    document.getElementById('sub-f-renew').value    = s.renewal_date ? new Date(s.renewal_date).toISOString().slice(0,10) : '';
    document.getElementById('sub-f-status').value   = s.status            || 'Active';
    document.getElementById('sub-f-remarks').value  = s.remarks           || '';
    openM('m-sub-add');
  } catch { showToast('Failed to load subscription for editing', 't-error'); }
}

/* ──────────────────────────────────────────────────────────
   ATTACHMENT SYSTEM  (v2 — collapsible, drag & drop, 10MB limit)
────────────────────────────────────────────────────────── */

// FILE SIZE LIMIT (modifiable) — currently 10MB
const ATTACHMENT_MAX_MB    = 10;
const ATTACHMENT_MAX_BYTES = ATTACHMENT_MAX_MB * 1024 * 1024;

async function attachmentPanel(module, recordId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="dp-section-hd att-toggle"
      onclick="toggleAttPanel('${containerId}')"
      style="cursor:pointer;display:flex;align-items:center;justify-content:space-between">
      <span><i data-lucide="paperclip"></i> Attachments</span>
      <span id="att-arrow-${containerId}" style="font-size:12px">▼ Show</span>
    </div>
    <div id="att-body-${containerId}" style="display:none">
      <div style="color:var(--slate-400);font-size:12px;padding:8px 0">Loading…</div>
    </div>`;

  if (window.lucide) lucide.createIcons();

  try {
    const res  = await fetch(`${API_URL}/api/attachments/${module}/${recordId}`);
    const list = await res.json();
    _renderAttBody(module, recordId, containerId, list);
  } catch {
    const body = document.getElementById(`att-body-${containerId}`);
    if (body) body.innerHTML = `<div style="color:var(--red-500);font-size:12px">Failed to load attachments.</div>`;
  }
}

function toggleAttPanel(containerId) {
  const body  = document.getElementById(`att-body-${containerId}`);
  const arrow = document.getElementById(`att-arrow-${containerId}`);
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display  = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '▲ Hide' : '▼ Show';
}

function _renderAttBody(module, recordId, containerId, files) {
  const inputId = `att-input-${module}-${recordId}`;
  const listId  = `att-list-${module}-${recordId}`;

  const fileRows = files.length
    ? files.map(f => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--slate-100)">
          <span style="flex-shrink:0">${_attIcon(f.file_type)}</span>
          <span style="flex:1;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${_esc(f.file_name)}">${_esc(f.file_name)}</span>
          ${f.file_size_kb ? `<span style="font-size:11px;color:var(--slate-400);white-space:nowrap">${f.file_size_kb} KB</span>` : ''}
          <button class="btn btn-xs btn-outline" onclick="window.open('${f.file_url}','_blank')"><i data-lucide="download"></i> Download</button>
          <button class="btn btn-xs btn-red"
            onclick="deleteAttachment(${f.attachment_id},'${module}',${recordId},'${containerId}')"><i data-lucide="x"></i></button>
        </div>`).join('')
    : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No attachments yet.</div>`;

  const body = document.getElementById(`att-body-${containerId}`);
  if (!body) return;
  body.innerHTML = `
    <div id="${inputId}-dropzone"
      style="border:1.5px dashed var(--slate-300);border-radius:var(--radius-sm);
             padding:16px;text-align:center;margin:8px 0;cursor:pointer;transition:background 0.2s"
      ondragover="event.preventDefault();this.style.background='var(--blue-50)'"
      ondragleave="this.style.background=''"
      ondrop="_handleDrop(event,'${module}',${recordId},'${containerId}')"
      onclick="document.getElementById('${inputId}').click()">
      <div style="margin-bottom:4px"><i data-lucide="paperclip" style="width:22px;height:22px"></i></div>
      <div style="font-size:12px;color:var(--slate-400)">Drag & drop or <strong>click to upload</strong></div>
      <div style="font-size:11px;color:var(--slate-300);margin-top:3px">Max ${ATTACHMENT_MAX_MB}MB per file</div>
    </div>
    <input type="file" id="${inputId}" style="display:none"
      onchange="_uploadFromInput('${module}',${recordId},'${inputId}','${containerId}')"/>
    <div id="${listId}">${fileRows}</div>`;

  if (window.lucide) lucide.createIcons();
}

async function _handleDrop(event, module, recordId, containerId) {
  event.preventDefault();
  event.currentTarget.style.background = '';
  const file = event.dataTransfer.files[0];
  if (!file) return;
  await _processUpload(file, module, recordId, containerId);
}

async function _uploadFromInput(module, recordId, inputId, containerId) {
  const input = document.getElementById(inputId);
  const file  = input?.files[0];
  if (!file) return;
  await _processUpload(file, module, recordId, containerId);
  if (input) input.value = '';
}

async function _processUpload(file, module, recordId, containerId) {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    showToast(`File too large (max ${ATTACHMENT_MAX_MB}MB)`, 't-error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await fetch(`${API_URL}/api/attachments`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          module, record_id: recordId,
          file_name:    file.name,
          file_url:     reader.result,
          file_type:    file.type,
          file_size_kb: Math.round(file.size / 1024),
          uploaded_by:  currentUser?.user_id || null,
        }),
      });
      if (!res.ok) throw new Error('Upload failed');
      showToast(`"${file.name}" uploaded`, 't-success');
      // Refresh panel and keep it open
      await attachmentPanel(module, recordId, containerId);
      setTimeout(() => {
        const body  = document.getElementById(`att-body-${containerId}`);
        const arrow = document.getElementById(`att-arrow-${containerId}`);
        if (body)  body.style.display  = 'block';
        if (arrow) arrow.textContent   = '▲ Hide';
      }, 100);
    } catch { showToast('Upload failed', 't-error'); }
  };
  reader.readAsDataURL(file);
}

async function deleteAttachment(attachmentId, module, recordId, containerId) {
  try {
    const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Attachment removed', 't-warning');
    await attachmentPanel(module, recordId, containerId);
    setTimeout(() => {
      const body  = document.getElementById(`att-body-${containerId}`);
      const arrow = document.getElementById(`att-arrow-${containerId}`);
      if (body)  body.style.display  = 'block';
      if (arrow) arrow.textContent   = '▲ Hide';
    }, 100);
  } catch { showToast('Failed to delete attachment', 't-error'); }
}

function _attIcon(mimeType) {
  const size = 'style="width:18px;height:18px"';
  if (!mimeType) return `<i data-lucide="file" ${size}></i>`;
  if (mimeType.startsWith('image/'))                                   return `<i data-lucide="image" ${size}></i>`;
  if (mimeType === 'application/pdf')                                  return `<i data-lucide="file-text" ${size}></i>`;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))  return `<i data-lucide="sheet" ${size}></i>`;
  if (mimeType.includes('word'))                                       return `<i data-lucide="file-type" ${size}></i>`;
  return `<i data-lucide="file" ${size}></i>`;
}

function _esc(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ──────────────────────────────────────────────────────────
   EXPORT CSV
────────────────────────────────────────────────────────── */
function exportUnifiedSubscriptions() {
  const rows = document.querySelectorAll('#uni-tbody tr');
  if (!rows.length) { showToast('No data to export', 't-error'); return; }

  const headers = ['Source','Name','Assigned To','Supplier','Cost','Expiry','Status'];
  const csvRows = [headers.join(',')];
  rows.forEach(tr => {
    const cells = [...tr.querySelectorAll('td')].map(td => `"${td.innerText.trim().replace(/"/g,'""')}"`);
    csvRows.push(cells.join(','));
  });

  const csv  = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Subscriptions_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported successfully', 't-success');
}


/* ══════════════════ M365 ══════════════════ */

let deleteM365Id    = null;
let deleteM365Label = '';

async function deleteM365Prompt(id) {
  deleteM365Id = id;
  deleteM365Label = `License #${id}`; // fallback while fetching
  try {
    const m = await fetchOne('m365', id);
    deleteM365Label = m?.assigned_email || `License #${id}`;
  } catch (err) {
    console.error('deleteM365Prompt fetch error:', err);
  }
  const labelEl = document.getElementById('m365-del-label');
  if (labelEl) labelEl.textContent = deleteM365Label;
  openM('m-confirm-m365-del');
}

function confirmDeleteM365() {
  fetch(`${API_URL}/api/m365/${deleteM365Id}`, { method: 'DELETE' })
    .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('License deleted', 't-warning');
      addLog('DELETE', 'M365 LICENSE', `Deleted M365 license: ${deleteM365Label}`, deleteM365Id);
      closeM('m-confirm-m365-del');
      closeDP();
      renderM365();
    })
    .catch(err => showToast(err.message || 'Delete failed', 't-error'));
}

/* ══════════════════ GLOBE ══════════════════ */

let deleteGlobeId    = null;
let deleteGlobeLabel = '';

async function deleteGlobePrompt(id) {
  deleteGlobeId = id;
  deleteGlobeLabel = `Plan #${id}`; // fallback while fetching
  try {
    const g = await fetchOne('globe', id);
    deleteGlobeLabel = g?.employee_name
      ? `${g.employee_name} (${g.mobile_number || 'no number'})`
      : (g?.mobile_number || `Plan #${id}`);
  } catch (err) {
    console.error('deleteGlobePrompt fetch error:', err);
  }
  const labelEl = document.getElementById('globe-del-label');
  if (labelEl) labelEl.textContent = deleteGlobeLabel;
  openM('m-confirm-globe-del');
}

function confirmDeleteGlobe() {
  fetch(`${API_URL}/api/globe/${deleteGlobeId}`, { method: 'DELETE' })
    .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('Plan deleted', 't-warning');
      addLog('DELETE', 'GLOBE PLAN', `Deleted Globe plan: ${deleteGlobeLabel}`, deleteGlobeId);
      closeM('m-confirm-globe-del');
      closeDP();
      renderGlobe();
    })
    .catch(err => showToast(err.message || 'Delete failed', 't-error'));
}

/* ══════════════════ OTHER SUBSCRIPTIONS ══════════════════ */

let deleteSubId    = null;
let deleteSubLabel = '';

async function deleteSubPrompt(id) {
  deleteSubId = id;
  deleteSubLabel = `Subscription #${id}`; // fallback while fetching
  try {
    const s = await fetchOne('subscriptions', id);
    deleteSubLabel = s?.subscription_name || `Subscription #${id}`;
  } catch (err) {
    console.error('deleteSubPrompt fetch error:', err);
  }
  const labelEl = document.getElementById('sub-del-label');
  if (labelEl) labelEl.textContent = deleteSubLabel;
  openM('m-confirm-sub-del');
}

function confirmDeleteSubscription() {
  fetch(`${API_URL}/api/subscriptions/${deleteSubId}`, { method: 'DELETE' })
    .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('Subscription deleted', 't-warning');
      addLog('DELETE', 'SUBSCRIPTION', `Deleted subscription: ${deleteSubLabel}`, deleteSubId);
      closeM('m-confirm-sub-del');
      closeDP();
      renderSubscriptions();
    })
    .catch(err => showToast(err.message || 'Delete failed', 't-error'));
}

if (typeof DP_RENDERERS !== 'undefined') {
  DP_RENDERERS.m365          = dpM365;
  DP_RENDERERS.globe         = dpGlobe;
  DP_RENDERERS.subscriptions = dpSubscriptions;
}
