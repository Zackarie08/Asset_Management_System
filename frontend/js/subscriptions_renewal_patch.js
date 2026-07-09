/* ============================================================
   subscriptions_renewal_patch.js
   ============================================================
   Overrides functions from subscriptions_unified.js to implement:
     • M365: Licensed / No License status, renewal_date only
       (start_date / expiry_date fields removed from the form).
     • Globe: start_date removed from the form; status now trusts
       the backend's computed_status verbatim (backend fix in
       globe.js — see Globe_Status_Audit.md).
     • Other Subscriptions: start_date / expiry_date replaced with
       renewal_date (billing-cycle aware).
     • statusBadge() extended with Licensed / No License mappings.

   Load AFTER subscriptions_unified.js (end of index.html, same
   pattern as laptop_dashboard_patches.js).

   REQUIRED index.html changes — see
   M365_Renewal_Logic_Update.md / Other_Subscription_Renewal_System.md
   for the exact find/replace blocks (remove Start/Expiry Date
   inputs, add Renewal Date inputs).
   ============================================================ */

/* ── Status badge: add Licensed / No License / For Renewal ──── */
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

/* ══════════════════ UNIFIED TABLE ══════════════════ */
async function renderSubscriptionsUnified() {
  const [m365Data, globeData, subData] = await Promise.all([
    fetch(`${API_URL}/api/m365`).then(r => r.json()).catch(() => []),
    fetch(`${API_URL}/api/globe`).then(r => r.json()).catch(() => []),
    fetch(`${API_URL}/api/subscriptions`).then(r => r.json()).catch(() => []),
  ]);

  const sourceFilter   = document.getElementById('uni-filter-source')?.value   || 'all';
  const statusFilter   = document.getElementById('uni-filter-status')?.value   || 'all';
  const categoryFilter = document.getElementById('uni-filter-category')?.value || 'all';

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
        assignedTo: g.employee_name || '—',
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
  if (categoryFilter !== 'all') rows = rows.filter(r => r.category === categoryFilter);

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

/* ══════════════════ M365 ══════════════════ */
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
            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editM365(${m.license_id})">✏️</button>
            <button class="btn btn-xs btn-red"     onclick="event.stopPropagation();deleteM365Prompt(${m.license_id})">🗑️</button>
          </div></td>`;
        tr.addEventListener('click', () => openDP('m365', m.license_id, tr));
        tbody.appendChild(tr);
      });
      _setTxt('m365-exp-ct', `${noLicenseCount} no license`);
      _setTxt('m365-ct',     `${data.length} licenses`);
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
    setDPHeader('💼', '#f0f9ff', m.assigned_email || '—', 'M365 License');
    const html = `
      <div class="dp-status-row">${statusBadge(status)}<span class="dp-status-label">License status</span></div>
      <div class="dp-section">
        <div class="dp-section-hd">📧 License Info</div>
        <div class="dp-grid">
          ${dpField('Assigned Email', m.assigned_email || '—')}
          ${dpField('Assigned User',  m.assigned_user_name || 'Unassigned')}
          ${dpField('License Type',   m.license_type  || '—')}
          ${dpField('Monthly Cost',   fmtCost(m.monthly_cost ?? m.license_cost))}
        </div>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd">📅 Renewal (Yearly)</div>
        <div class="dp-grid">
          ${dpField('Renewal Date', fmtDate(m.renewal_date))}
          ${dpField('Next Renewal', fmtDate(m.next_renewal_date))}
          ${m.renewal_alert_active ? dpField('Alert', '<span class="badge b-amber">⚠️ Renewal window (within 3 days)</span>') : ''}
        </div>
      </div>
      ${m.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', m.remarks)}</div></div>` : ''}
      <div class="dp-section" id="dp-att-m365-${id}"></div>
      ${isAdminUser() ? `
        <div class="dp-section">
          <div class="dp-section-hd">⚡ Actions</div>
          <div class="dp-action-row">
            <button class="btn btn-primary btn-sm" onclick="editM365(${m.license_id})">✏️ Edit</button>
            <button class="btn btn-red btn-sm"     onclick="deleteM365Prompt(${m.license_id})">🗑️ Delete</button>
          </div>
        </div>` : ''}`;
    document.getElementById('dp-body').innerHTML = html;
    document.getElementById('dp-footer').style.display = 'none';
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

/* ══════════════════ GLOBE (drop Start Date field) ══════════════════ */
function saveGlobe() {
  const userName = document.getElementById('globe-f-user').value;
  const mobile   = document.getElementById('globe-f-num').value.trim();
  const plan     = document.getElementById('globe-f-plan').value.trim();
  const renew    = document.getElementById('globe-f-renew').value;

  if (!mobile || !plan || !renew) { showToast('Mobile number, plan name, and renewal date are required', 't-error'); return; }
  if (!selectState['globe-f-user']) { showToast('Select a valid employee', 't-error'); return; }
  const mobilePattern = /^09\d{2}-\d{3}-\d{4}$/;
  if (!mobilePattern.test(mobile)) { showToast('Invalid mobile format (e.g. 0917-123-4567)', 't-error'); return; }

  const payload = {
    user_id:        globeUserMap[userName] || null,
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
    selectState['globe-f-user'] = true;
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

async function dpGlobe(id) {
  try {
    const g      = await fetchOne('globe', id);
    const status = g.computed_status;
    setDPHeader('📱', '#f0fdf4', g.employee_name || '—', 'Globe Mobile Plan');
    const html = `
      <div class="dp-status-row">${statusBadge(status)}<span class="dp-status-label">Plan status</span></div>
      <div class="dp-section">
        <div class="dp-section-hd">👤 Subscriber</div>
        <div class="dp-grid">
          ${dpField('Employee',   g.employee_name  || '—')}
          ${dpField('Mobile No.', g.mobile_number  || '—')}
          ${dpField('Account No.',g.account_number || '—')}
        </div>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd">📱 Plan Details</div>
        <div class="dp-grid">
          ${dpField('Plan Name',    g.plan_name      || '—')}
          ${dpField('Monthly Cost', fmtCost(g.monthly_cost))}
          ${dpField('Data',         g.data_allocation|| '—')}
          ${dpField('Credit Limit', fmtCost(g.credit_limit))}
          ${dpField('Renewal Date', fmtDate(g.renewal_date))}
          ${dpField('Next Renewal', fmtDate(g.next_renewal_date))}
          ${g.renewal_alert_active ? dpField('Alert', '<span class="badge b-amber">⚠️ Renewal window (within 3 days)</span>') : ''}
        </div>
      </div>
      <div class="dp-section">
        <div class="dp-section-hd">🎁 Plan Inclusions</div>
        <div class="dp-grid">
          ${dpField('Unli All-Net Calls', g.unli_allnet_calls ? '<span class="badge b-green">Included</span>' : '<span class="badge b-slate">Not Included</span>')}
          ${dpField('Unli Text', g.unli_text ? '<span class="badge b-green">Included</span>' : '<span class="badge b-slate">Not Included</span>')}
          ${dpField('Data Allocation', g.data_allocation || null)}
          ${dpFieldFull('Freebie', g.freebie || null)}
        </div>
      </div>
      ${g.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', g.remarks)}</div></div>` : ''}
      <div class="dp-section" id="dp-att-globe-${id}"></div>
      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
          <button class="btn btn-primary btn-sm" onclick="editGlobe(${g.plan_id})">✏️ Edit</button>
          <button class="btn btn-red btn-sm"     onclick="deleteGlobePrompt(${g.plan_id})">🗑️ Delete</button>
        </div>
      </div>`;
    document.getElementById('dp-body').innerHTML = html;
    document.getElementById('dp-footer').style.display = 'none';
    attachmentPanel('globe', id, `dp-att-globe-${id}`);
  } catch (err) { showToast('Failed to load Globe plan', 't-error'); }
}

/* ══════════════════ OTHER SUBSCRIPTIONS ══════════════════ */
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
            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editSubscription(${s.subscription_id})">✏️</button>
            <button class="btn btn-xs btn-red"     onclick="event.stopPropagation();deleteSubPrompt(${s.subscription_id})">🗑️</button>
          </div></td>`;
        tr.addEventListener('click', () => openDP('subscriptions', s.subscription_id, tr));
        tbody.appendChild(tr);
      });
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
          ${dpField('Monthly Cost',fmtCost(s.monthly_cost))}
          ${dpField('Billing',     s.billing_cycle     || '—')}
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
      ${isAdminUser() ? `
        <div class="dp-section">
          <div class="dp-section-hd">⚡ Actions</div>
          <div class="dp-action-row">
            <button class="btn btn-primary btn-sm" onclick="editSubscription(${s.subscription_id})">✏️ Edit</button>
            <button class="btn btn-red btn-sm"     onclick="deleteSubPrompt(${s.subscription_id})">🗑️ Delete</button>
          </div>
        </div>` : ''}`;
    document.getElementById('dp-body').innerHTML = html;
    document.getElementById('dp-footer').style.display = 'none';
    attachmentPanel('subscriptions', id, `dp-att-sub-${id}`);
  } catch (err) { showToast('Failed to load subscription', 't-error'); }
}

function saveSubscription() {
  const name     = document.getElementById('sub-f-name').value.trim();
  const category = document.getElementById('sub-f-cat').value;
  const renewal  = document.getElementById('sub-f-renew').value;
  if (!name || !category) { showToast('Subscription name and category are required', 't-error'); return; }

  const payload = {
    subscription_name: name,
    category,
    supplier:      document.getElementById('sub-f-supplier').value.trim() || null,
    assigned_to:   document.getElementById('sub-f-assigned').value.trim() || null,
    monthly_cost:  document.getElementById('sub-f-cost').value    || null,
    billing_cycle: document.getElementById('sub-f-cycle').value,
    renewal_date:  renewal || null,
    status:        document.getElementById('sub-f-status').value,
    remarks:       document.getElementById('sub-f-remarks').value,
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
    document.getElementById('sub-f-renew').value    = s.renewal_date ? new Date(s.renewal_date).toISOString().slice(0,10) : '';
    document.getElementById('sub-f-status').value   = s.status            || 'Active';
    document.getElementById('sub-f-remarks').value  = s.remarks           || '';
    openM('m-sub-add');
  } catch { showToast('Failed to load subscription for editing', 't-error'); }
}
