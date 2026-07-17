/* ============================================================
   subscriptions_history_patch.js — Main + Assignment History
   for M365 / Globe / Other Subscriptions
   ============================================================
   Adds "View Item History" to all three DPs and sends performed_by
   on every save so backend attribution (main + assignment history,
   already added in m365.js/globe.js/subscriptions.js) isn't null.

   "Assignment history" here means: assignment changes are logged as
   ASSIGNED/UNASSIGNED entries within the SAME item_history timeline
   (filterable by action in the History panel), rather than a second
   dedicated table — consistent with how Insurance's coverage changes
   already work. The general CREATED/EDITED/DELETED events and the
   ASSIGNED/UNASSIGNED events both show in one "View Item History"
   list, distinguishable by their action label/icon.

   Load AFTER subscriptions_renewal_patch.js and item_history_panel.js.
   ============================================================ */

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

/* ── DPs: add View Item History to each ─────────────────────── */

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
      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
          ${isAdminUser() ? `
            <button class="btn btn-primary btn-sm" onclick="editM365(${m.license_id})">✏️ Edit</button>
            <button class="btn btn-red btn-sm"     onclick="deleteM365Prompt(${m.license_id})">🗑️ Delete</button>
          ` : ''}
          ${itemHistoryButton('m365', m.license_id, m.assigned_email)}
        </div>
      </div>`;
    document.getElementById('dp-body').innerHTML = html;
    document.getElementById('dp-footer').style.display = 'none';
    attachmentPanel('m365', id, `dp-att-m365-${id}`);
  } catch (err) { showToast('Failed to load license', 't-error'); }
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
          ${itemHistoryButton('globe', g.plan_id, g.employee_name || g.plan_name)}
        </div>
      </div>`;
    document.getElementById('dp-body').innerHTML = html;
    document.getElementById('dp-footer').style.display = 'none';
    attachmentPanel('globe', id, `dp-att-globe-${id}`);
  } catch (err) { showToast('Failed to load Globe plan', 't-error'); }
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

if (typeof DP_RENDERERS !== 'undefined') {
  DP_RENDERERS.m365          = dpM365;
  DP_RENDERERS.globe         = dpGlobe;
  DP_RENDERERS.subscriptions = dpSubscriptions;
}

