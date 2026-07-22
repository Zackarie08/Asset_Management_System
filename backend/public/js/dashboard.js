
/* ──────────────────────────────────────────────────────────────
   DASHBOARD REFRESH
────────────────────────────────────────────────────────────── */
/* ── Safe fetch helper ─────────────────────────────────────── */
async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ── Date helpers ──────────────────────────────────────────── */
function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}


/* ══════════════════════════════════════════════════════════════
   MAIN DASHBOARD REFRESH
══════════════════════════════════════════════════════════════ */
async function refreshDashboard() {

document.getElementById('dash-date').textContent = formatDateHuman(new Date());

  const [
    inventory, orders, laptops, vehicles, contracts, logs, globe, m365, contractRequests,
    wineReqs, invBorrows, itBorrows, itSuppliesList,
    insuranceList, otherSubs, 
  ] = await Promise.all([
      safeFetch(`${API_URL}/api/inventory`),
      safeFetch(`${API_URL}/api/po`),
      safeFetch(`${API_URL}/api/laptops`),
      safeFetch(`${API_URL}/api/vehicle`),
      safeFetch(`${API_URL}/api/contracts`),
      safeFetch(`${API_URL}/api/logs`),
      safeFetch(`${API_URL}/api/globe`),
      safeFetch(`${API_URL}/api/m365`),
      safeFetch(`${API_URL}/api/contracts/requests`),
      safeFetch(`${API_URL}/api/wine-requests`),
      safeFetch(`${API_URL}/api/borrow-return/open/inventory`),
      safeFetch(`${API_URL}/api/borrow-return/open/itsupplies`),
      safeFetch(`${API_URL}/api/it-supplies`),
      safeFetch(`${API_URL}/api/insurance`),                         // ✅ NEW
      safeFetch(`${API_URL}/api/subscriptions`),                     // ✅ NEW — "Other" subscriptions
    ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /* ── STAT CARDS (unchanged) ─────────────────── */
  const totalInv       = inventory.length;
  const lowStock        = inventory.filter(i => i.current_quantity <= i.reorder_level);
  const activeLaptops   = laptops.filter(l => l.status === 'Active');
  const pendingOrders   = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');

  _setText('dc-total',    totalInv);
  _setText('dc-total-d',  `${totalInv} tracked items`);
  _setText('dc-low',      lowStock.length);
  _setText('dc-low-d',    lowStock.length ? `${lowStock.length} item${lowStock.length > 1 ? 's' : ''} need restocking` : 'All stocks are Good');
  _setText('dc-laptops',   activeLaptops.length);
  _setText('dc-laptops-d', `${activeLaptops.length} of ${laptops.length} active`);
  _setText('dc-orders',   pendingOrders.length);
  _setText('dc-orders-d', pendingOrders.length ? `${pendingOrders.length} pending` : 'No pending orders');

  /* ── PANEL 1 — LOW STOCK ✅ NOW ALSO: PENDING WINE REQUESTS +
     BORROWED EVENT/IT SUPPLIES ─────────────────────────────────── */
  const itMap = {};
  itSuppliesList.forEach(it => { itMap[it.it_supplies_id] = it.asset_name; });
  const invMap = {};
  inventory.forEach(i => { invMap[i.inventory_gen_id] = i.item_name; });

  const requestRows = [
    ...wineReqs.map(r => ({
      dotCls: 'amber',
      name: r.item_name || invMap[r.inventory_gen_id] || 'Wine item',
      meta: `🍷 Wine · Requested by ${_esc(r.requested_name)} · ${r.quantity} unit(s)`,
      badgeLabel: 'Pending', badgeCls: 'b-amber',
    })),
    ...invBorrows.filter(b => b.status === 'BORROWED').map(b => ({
      dotCls: 'blue',
      name: invMap[b.record_id] || `Item #${b.record_id}`,
      meta: `📤 Event Supplies · Borrowed by ${_esc(b.borrowed_by_name)} · ${b.quantity} unit(s)`,
      badgeLabel: 'Borrowed', badgeCls: 'b-blue',
    })),
    ...itBorrows.filter(b => b.status === 'BORROWED').map(b => ({
      dotCls: 'blue',
      name: itMap[b.record_id] || `Item #${b.record_id}`,
      meta: `📤 IT Supplies · Borrowed by ${_esc(b.borrowed_by_name)} · ${b.quantity} unit(s)`,
      badgeLabel: 'Borrowed', badgeCls: 'b-blue',
    })),
  ];

  _setText('dash-low-ct', `${lowStock.length} low stock · ${requestRows.length} requests`);

  if (lowStock.length === 0 && requestRows.length === 0) {
    _setHTML('dash-low-list', _emptyMsg('All inventory levels are Good — no pending requests'));
  } else {
    const lowRowsHTML = lowStock.map(i => {
      const critical = i.current_quantity === 0;
      return `
        <div class="panel-row">
          <div class="pr-dot ${critical ? 'red' : 'amber'}"></div>
          <div style="flex:1">
            <div class="pr-name">${_esc(i.item_name)}</div>
            <div class="pr-meta">${_esc(i.category)} · Qty: ${i.current_quantity} / Reorder: ${i.reorder_level} ${i.unit || ''}</div>
          </div>
          ${badge(critical ? 'Critical' : 'Low Stock', critical ? 'b-red' : 'b-amber')}
        </div>`;
    }).join('');

    const requestRowsHTML = requestRows.map(r => `
      <div class="panel-row">
        <div class="pr-dot ${r.dotCls}"></div>
        <div style="flex:1">
          <div class="pr-name">${_esc(r.name)}</div>
          <div class="pr-meta">${r.meta}</div>
        </div>
        ${badge(r.badgeLabel, r.badgeCls)}
      </div>`).join('');

    _setHTML('dash-low-list', lowRowsHTML + requestRowsHTML);
  }

  /* ── PANEL 2 — PENDING / DELAYED ORDERS (unchanged) ── */
  const enrichedOrders = orders.map(o => {
    let status = o.status;
    if (status !== 'DELIVERED' && status !== 'CANCELLED' && o.expected_delivery_date) {
      const eta = new Date(o.expected_delivery_date);
      eta.setHours(0, 0, 0, 0);
      if (eta < today) status = 'DELAYED';
    }
    return { ...o, effectiveStatus: status };
  });
  const activeOrders = enrichedOrders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.effectiveStatus));
  const delayedCount = activeOrders.filter(o => o.effectiveStatus === 'DELAYED').length;

  _setText('dash-order-ct', `${activeOrders.length} orders`);
  const delayedBadge = document.getElementById('po-delay-ct');
  if (delayedBadge) delayedBadge.textContent = `${delayedCount} delayed`;

  if (activeOrders.length === 0) {
    _setHTML('dash-order-list', _emptyMsg('No pending orders'));
  } else {
    const rows = activeOrders.map(o => {
      const s = o.effectiveStatus;
      const dotCls = s === 'DELAYED' ? 'red' : s === 'IN TRANSIT' ? 'blue' : 'amber';
      const bdgCls = s === 'DELAYED' ? 'b-red' : s === 'IN TRANSIT' ? 'b-blue' : 'b-amber';
      return `
        <div class="panel-row">
          <div class="pr-dot ${dotCls}"></div>
          <div style="flex:1">
            <div class="pr-name">${_esc(o.item_name || `Item #${o.item_id}`)}</div>
            <div class="pr-meta">PO #${o.purchase_order_id} · ETA: ${formatDateHuman(o.expected_delivery_date)}</div>
          </div>
          ${badge(s, bdgCls)}
        </div>`;
    }).join('');
    _setHTML('dash-order-list', rows);
  }

  /* ── PANEL 3 — LAPTOP ALERTS (unchanged) ─────────── */
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const isMaintenanceMonth = currentMonth === 6 || currentMonth === 12;

  const laptopAlerts = [];
  laptops.forEach(lp => {
    if (lp.status === 'For Repair') { laptopAlerts.push({ lp, reason: 'For Repair', cls: 'red' }); return; }
    if (!lp.current_user_id) return;
    if (lp.date_of_purchase && lp.user_role !== 'intern') {
      const ageYears = (now - new Date(lp.date_of_purchase)) / (365.25 * 24 * 3600 * 1000);
      if (ageYears >= 3) {
        laptopAlerts.push({ lp, reason: `${Math.floor(ageYears)}y old`, cls: 'amber' });
      }
    }
  });

  let laptopHeader = `${laptopAlerts.length} alerts`;
  if (isMaintenanceMonth && laptops.length > 0) laptopHeader = `${laptopAlerts.length} alerts · ⚠️ Check month`;
  _setText('dash-maint-ct', laptopHeader);

  if (laptopAlerts.length === 0 && !isMaintenanceMonth) {
    _setHTML('dash-maint-list', _emptyMsg('No laptop alerts'));
  } else {
    let html = '';
    if (isMaintenanceMonth) {
      html += `
        <div class="panel-row" style="background:var(--amber-50)">
          <div class="pr-dot amber"></div>
          <div style="flex:1">
            <div class="pr-name">Scheduled Technical Check</div>
            <div class="pr-meta">${currentMonth === 6 ? 'June' : 'December'} — Check all laptops this month</div>
          </div>
          ${badge('Reminder', 'b-amber')}
        </div>`;
    }
    if (laptopAlerts.length === 0) {
      html += _emptyMsg('No other laptop alerts');
    } else {
      html += laptopAlerts.map(({ lp, reason, cls }) => {
        const assignedLabel = lp.current_user_id
          ? _esc(lp.user_name || 'Unknown user')
          : 'Unassigned';
        return `
        <div class="panel-row">
          <div class="pr-dot ${cls}"></div>
          <div style="flex:1">
            <div class="pr-name">${_esc(lp.serial_number)} • ${_esc(lp.asset_number)}</div>
            <div class="pr-meta">${assignedLabel} • ${_esc(lp.item_description)}</div>
          </div>
          ${badge(reason, `b-${cls}`)}
        </div>`;
      }).join('');
    }
    _setHTML('dash-maint-list', html);
  }

  /* ── PANEL 4 — VEHICLE ALERTS (unchanged — Part 5 fix preserved) ── */
  const isFirstWorkingDay = (() => {
    const d = now.getDay();
    const day = now.getDate();
    return day <= 3 && d !== 0 && d !== 6;
  })();

  const vehicleAlerts = [];

  await Promise.all(vehicles.map(async v => {
    if (v.status === 'UNDER_MAINTENANCE') {
      vehicleAlerts.push({ v, reason: 'Under Maintenance', cls: 'blue' });
      return;
    }

    const kmUsed = (v.odometer || 0) - (v.last_maintenance_km || 0);
    const threshold = v.maintenance_threshold || 1000;
    if (kmUsed >= threshold) {
      vehicleAlerts.push({ v, reason: `${kmUsed} km since last service`, cls: 'red' });
    }

    let plans = [];
    try {
      plans = await fetchPlansForVehicle(v.vehicle_id);
    } catch { plans = []; }

    const km = v.odometer || 0;
    plans.forEach(p => {
      const s = p.basis === 'odometer' ? planOdoStatus(p, km) : planTimeStatus(p);
      if (s === 'overdue') {
        vehicleAlerts.push({ v, reason: `${p.name}: Overdue`, cls: 'red' });
      } else if (s === 'due_soon') {
        vehicleAlerts.push({ v, reason: `${p.name}: Due Soon`, cls: 'amber' });
      }
    });
  }));

  _setText('dash-veh-ct', `${vehicleAlerts.length} alerts`);
  if (vehicleAlerts.length === 0 && !isFirstWorkingDay) {
    _setHTML('dash-veh-list', _emptyMsg('All vehicles on schedule'));
  } else {
    let html = '';
    if (isFirstWorkingDay) {
      html += `
        <div class="panel-row" style="background:var(--blue-50)">
          <div class="pr-dot blue"></div>
          <div style="flex:1">
            <div class="pr-name">Monthly Odometer Update</div>
            <div class="pr-meta">Please update odometer readings for all vehicles</div>
          </div>
          ${badge('Reminder', 'b-blue')}
        </div>`;
    }
    if (vehicleAlerts.length === 0) {
      html += _emptyMsg('No vehicle maintenance alerts');
    } else {
      html += vehicleAlerts.map(({ v, reason, cls }) => `
        <div class="panel-row">
          <div class="pr-dot ${cls}"></div>
          <div style="flex:1">
            <div class="pr-name">${_esc(v.vehicle_name)}</div>
            <div class="pr-meta">${_esc(v.plate_number)} · ${_esc(v.type)}</div>
          </div>
          ${badge(reason, `b-${cls}`)}
        </div>`).join('');
    }
    _setHTML('dash-veh-list', html);
  }

  /* ── PANEL 5 — CONTRACTS (unchanged) ─────────────── */
  const contractAlerts = [];
  contracts.forEach(c => {
    if (c.validity_type === 'NA') return;
    let expiryDate = null;
    if (c.validity_type === 'YEAR' && c.valid_year) expiryDate = new Date(`${c.valid_year}-12-31`);
    else if (c.valid_to) expiryDate = new Date(c.valid_to);
    if (!expiryDate) return;
    const daysLeft = daysFromNow(expiryDate);
    if (daysLeft < 0) contractAlerts.push({ c, reason: 'Expired', cls: 'red', daysLeft });
    else if (daysLeft <= 30) contractAlerts.push({ c, reason: `Expires in ${daysLeft}d`, cls: 'amber', daysLeft });
  });

  const pendingContractRequests = isAdminUser() ? contractRequests.filter(r => r.status === 'PENDING') : [];
  const totalConItems = contractAlerts.length + pendingContractRequests.length;
  _setText('dash-con-ct', `${totalConItems} item${totalConItems === 1 ? '' : 's'}`);

  if (totalConItems === 0) {
    _setHTML('dash-con-list', _emptyMsg('All contracts current — no pending requests'));
  } else {
    let html = '';
    if (pendingContractRequests.length) {
      html += pendingContractRequests.map(r => `
        <div class="panel-row">
          <div class="pr-dot amber"></div>
          <div style="flex:1">
            <div class="pr-name">${_esc(r.requested_name)}</div>
            <div class="pr-meta">${_esc(r.other_party)} · ${_esc(r.description)} · Pending request</div>
          </div>
          ${badge('Pending', 'b-amber')}
        </div>`).join('');
    }
    if (contractAlerts.length) {
      html += contractAlerts.map(({ c, reason, cls }) => `
        <div class="panel-row">
          <div class="pr-dot ${cls}"></div>
          <div style="flex:1">
            <div class="pr-name">${_esc(c.other_party)}</div>
            <div class="pr-meta">${_esc(c.description)}</div>
          </div>
          ${badge(reason, `b-${cls}`)}
        </div>`).join('');
    }
    _setHTML('dash-con-list', html);
  }

/* ── PANEL 6 — ADMIN: SUBSCRIPTIONS + INSURANCE (Part 1 expansion) ──
     Was Globe+M365 only ("Subscription Alerts"). Now also folds in
     "Other" subscriptions and Insurance renewals/expirations into the
     SAME existing panel + a "View All" modal — no separate Insurance
     modal, no dashboard-wide modal. Also fixes a pre-existing bug where
     M365 alerts read `m.expiry_date` (field doesn't exist on that model —
     the correct field is `renewal_date`), which silently broke the
     "Expires ..." label for every M365 row. */
  const adminPanel = document.getElementById('dash-admin-wrap');
  if (adminPanel) adminPanel.style.display = isAdminUser() ? '' : 'none';

  if (isAdminUser()) {
    const globeAlerts    = globe.filter(g => g.status !== 'Inactive' && g.renewal_alert_active);
    const m365Alerts     = m365.filter(m => m.renewal_alert_active);
    const otherSubAlerts = otherSubs.filter(s => s.renewal_alert_active);

    // Same 30-day window used by backend/routes/notifications.js so the
    // panel never disagrees with what's driving the sidebar red dot.
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const insuranceAlerts = insuranceList.filter(i => {
      if (!i.expiry_date) return false;
      const days = Math.ceil((new Date(i.expiry_date) - today0) / 86400000);
      return days <= 30;
    });

    const totalActiveSubs = globe.filter(g => g.status === 'Active').length
      + m365.filter(m => m.status === 'Active').length
      + otherSubs.filter(s => s.computed_status === 'Active').length;

    const totalAlerts = globeAlerts.length + m365Alerts.length + otherSubAlerts.length + insuranceAlerts.length;

    _setText('dash-admin-ct', `${totalAlerts} alert${totalAlerts === 1 ? '' : 's'}`);
    _setText('dash-admin-subs', `${totalActiveSubs} active subscriptions · ${insuranceList.length} policies`);

    // Retitle the panel in place — same panel, same modal target, just a
    // broader name now that it covers Insurance too.
    const adminTitleEl = adminPanel.querySelector('.panel-title');
    if (adminTitleEl) {
      adminTitleEl.innerHTML = '<i data-lucide="lock"></i> Subscription & Insurance Alerts';
      if (window.lucide) lucide.createIcons();
    }

    const allAlerts = [
      ...globeAlerts.map(g => ({
        name: g.employee_name || g.plan_name || 'Globe Plan',
        detail: `Globe · ${g.plan_name || '—'} · Renews ${formatDateHuman(g.renewal_date)}`,
        daysLeft: daysFromNow(g.renewal_date),
        page: 'subscriptions', dpType: 'globe', recordId: g.plan_id,
      })),
      ...m365Alerts.map(m => ({
        name: m.assigned_email,
        detail: `M365 · ${m.license_type || '—'} · Renews ${formatDateHuman(m.renewal_date)}`,
        daysLeft: daysFromNow(m.renewal_date),
        page: 'subscriptions', dpType: 'm365', recordId: m.license_id,
      })),
      ...otherSubAlerts.map(s => ({
        name: s.subscription_name,
        detail: `${s.category || 'Subscription'} · Renews ${formatDateHuman(s.renewal_date)}`,
        daysLeft: daysFromNow(s.renewal_date),
        page: 'subscriptions', dpType: 'subscriptions', recordId: s.subscription_id,
      })),
      ...insuranceAlerts.map(i => {
        const dl = daysFromNow(i.expiry_date);
        return {
          name: i.employee_name,
          detail: `Insurance · ${i.provider || '—'} · ${dl < 0 ? 'Expired' : 'Expires'} ${formatDateHuman(i.expiry_date)}`,
          daysLeft: dl,
          page: 'insurance', dpType: 'insurance', recordId: i.insurance_id,
        };
      }),
    ].sort((a, b) => a.daysLeft - b.daysLeft); // most urgent first

    _lastSubInsAlerts = allAlerts; // cached for the modal (see below)

    if (allAlerts.length === 0) {
      _setHTML('dash-admin-list', _emptyMsg('No subscription or insurance alerts'));
    } else {
      // Keep the inline panel compact (max 6); full list lives in the modal.
      _setHTML('dash-admin-list', allAlerts.slice(0, 6).map(_renderSubInsAlertRow).join(''));
    }

    _ensureSubInsViewAllLink(adminPanel, allAlerts.length);
  }
}

/* ── Private helpers (internal to dashboard only) ────────── */
function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function _setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
function _emptyMsg(msg) {
  return `<div style="padding:16px;text-align:center;color:var(--slate-400);font-size:12.5px">${msg}</div>`;
}
function _esc(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   IMPROVEMENT: Dashboard — click items to navigate + open DP
   Replace _emptyMsg panels' panel-row onClick stubs with
   this helper. Call navigateAndOpen() from dashboard rows.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Navigate to a page, then open the detail panel for a record.
 * @param {string} page     - page id (e.g. "inventory", "contracts")
 * @param {string} dpType   - DP type key (e.g. "inventory", "contracts")
 * @param {number} recordId - the record's primary key
 */
function navigateAndOpen(page, dpType, recordId) {
  // 1. Navigate to the page
  const navEl = document.getElementById("nav-" + page);
  navigate(page, navEl);

  // 2. After a short paint delay, open the DP
  // We need the table row to mark as selected — find it by ID match
  setTimeout(() => {
    // Try to find the matching row in the rendered table
    const allRows = document.querySelectorAll(`#page-${page} .tr-clickable`);
    let targetRow = null;

    // Most tables render the PK in the first cell or as data-id
    allRows.forEach(row => {
      const firstCell = row.querySelector("td");
      if (firstCell && String(firstCell.textContent).trim() === String(recordId)) {
        targetRow = row;
      }
    });

    openDP(dpType, recordId, targetRow);
  }, 250); // 250ms gives the page time to render
}

let currentItemStock = 0;


/* ══════════════════════════════════════════════════════════════
   PART 1 — Subscription & Insurance Alerts modal
   Extends the EXISTING dash-admin panel (formerly "Subscription
   Alerts") to also cover Insurance. No new dashboard-wide modal,
   no separate Insurance modal — one panel, one modal, combined data.
   The modal markup is built via JS the first time it's needed, so
   index.html does not need to be touched.
══════════════════════════════════════════════════════════════ */

let _lastSubInsAlerts = [];

function _renderSubInsAlertRow(a) {
  const expired = a.daysLeft < 0;
  const cls   = expired ? 'red' : (a.daysLeft <= 3 ? 'amber' : 'blue');
  const label = expired ? 'Expired' : `${a.daysLeft}d left`;
  return `
    <div class="panel-row" style="cursor:pointer" onclick="_openAlertItem('${a.page}','${a.dpType}',${a.recordId})">
      <div class="pr-dot ${cls}"></div>
      <div style="flex:1">
        <div class="pr-name">${_esc(a.name)}</div>
        <div class="pr-meta">${_esc(a.detail)}</div>
      </div>
      ${badge(label, `b-${cls === 'blue' ? 'blue' : cls}`)}
    </div>`;
}


function _openAlertItem(page, dpType, recordId) {
  closeM('m-sub-ins-alerts');
  navigateAndOpen(page, dpType, recordId);
  markNotificationSeen(dpType, recordId);
}

function _ensureSubInsModal() {
  if (document.getElementById('m-sub-ins-alerts')) return;

  const overlay = document.createElement('div');
  overlay.id = 'm-sub-ins-alerts';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-hd">
        <div class="modal-title"><i data-lucide="bell"></i> Subscription & Insurance Alerts</div>
        <div class="modal-close" onclick="closeM('m-sub-ins-alerts')">✕</div>
      </div>
      <div class="modal-body" id="sub-ins-modal-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) e.stopPropagation(); });
}

function openSubInsuranceAlertsModal() {
  _ensureSubInsModal();
  const body = document.getElementById('sub-ins-modal-body');

  if (!_lastSubInsAlerts.length) {
    body.innerHTML = _emptyMsg('No subscription or insurance alerts');
  } else {
    body.innerHTML = _lastSubInsAlerts.map(_renderSubInsAlertRow).join('');
  }

  openM('m-sub-ins-alerts');
  if (window.lucide) lucide.createIcons();
}



