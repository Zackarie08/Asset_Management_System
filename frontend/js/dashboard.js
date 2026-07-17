
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

  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

  const [
    inventory, orders, laptops, vehicles, contracts, logs, globe, m365, contractRequests,
    wineReqs, invBorrows, itBorrows, itSuppliesList, // ✅ NEW
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
      safeFetch(`${API_URL}/api/wine-requests`),                    // ✅ NEW — all PENDING wine requests
      safeFetch(`${API_URL}/api/borrow-return/open/inventory`),      // ✅ NEW — borrowed event supplies
      safeFetch(`${API_URL}/api/borrow-return/open/itsupplies`),     // ✅ NEW — borrowed IT supplies
      safeFetch(`${API_URL}/api/it-supplies`),                       // ✅ NEW — for asset-name lookup
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

  /* ── PANEL 6 — ADMIN: GLOBE + M365 (unchanged) ───── */
  const adminPanel = document.getElementById('dash-admin-wrap');
  if (adminPanel) adminPanel.style.display = isAdminUser() ? '' : 'none';

  if (isAdminUser()) {
    const globeAlerts = globe.filter(g => g.status !== 'Inactive' && g.renewal_alert_active);
    const m365Alerts  = m365.filter(m => m.renewal_alert_active);
    const totalSubs = globe.filter(g => g.status === 'Active').length + m365.filter(m => m.status === 'Active').length;

    _setText('dash-admin-ct', `${globeAlerts.length + m365Alerts.length} alerts`);
    _setText('dash-admin-subs', `${totalSubs} active subscriptions`);

    const allSubAlerts = [
      ...globeAlerts.map(g => ({ name: g.employee_name, detail: `Globe · ${g.plan_name || '—'} · Renews ${formatDateHuman(g.renewal_date)}`, daysLeft: daysFromNow(g.renewal_date) })),
      ...m365Alerts.map(m => ({ name: m.assigned_email, detail: `M365 · ${m.license_type || '—'} · Expires ${formatDateHuman(m.expiry_date)}`, daysLeft: daysFromNow(m.expiry_date) })),
    ];

    if (allSubAlerts.length === 0) {
      _setHTML('dash-admin-list', _emptyMsg('No subscription alerts'));
    } else {
      const rows = allSubAlerts.map(a => {
        const expired = a.daysLeft < 0;
        const cls = expired ? 'red' : 'amber';
        const label = expired ? 'Expired' : `${a.daysLeft}d left`;
        return `
          <div class="panel-row">
            <div class="pr-dot ${cls}"></div>
            <div style="flex:1">
              <div class="pr-name">${_esc(a.name)}</div>
              <div class="pr-meta">${_esc(a.detail)}</div>
            </div>
            ${badge(label, `b-${cls}`)}
          </div>`;
      }).join('');
      _setHTML('dash-admin-list', rows);
    }
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






