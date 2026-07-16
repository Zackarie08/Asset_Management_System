/* ============================================================
   request_indicators_patch.js
   ============================================================
   Adds a visual indicator for outstanding Wine requests / borrowed
   Event Supplies / borrowed IT Supplies:
     1. A badge on the matching row in the Inventory table and the
        IT Supplies table.
     2. A merged section inside the Dashboard's "Low Stock" panel
        (renamed "⚠️ Low Stock & Pending Requests" — see the
        index.html title-text change in
        Request_Indicators_Implementation.md), listing every
        pending Wine request and every currently-borrowed Event/IT
        Supply item alongside the existing low-stock rows.

   Signal sources (all already existed, just weren't surfaced here):
     • GET /api/wine-requests            → all PENDING wine requests
     • GET /api/borrow-return/open/inventory  → BORROWED event supplies
     • GET /api/borrow-return/open/itsupplies → BORROWED IT supplies

   Load as the LAST script in index.html (after inventory.js, main.js,
   vehicle_dashboard_alert_patch.js) so these overrides win, per the
   project's last-loaded-wins pattern. This file re-declares
   refreshDashboard() ONE more time — it is a full copy of the version
   in vehicle_dashboard_alert_patch.js with ONLY Panel 1 (Low Stock)
   changed, so Part 5's vehicle-plan alert fix is preserved.
   ============================================================ */

/* ════════════════ INVENTORY TABLE — pending/borrowed badge ════════════════ */

async function renderInventory() {
  const res = await fetch(`${API_URL}/api/inventory`);
  const allItems = await res.json();

  // ✅ NEW: pending-request signals for the visual indicator badges
  const [wineReqs, invBorrows] = await Promise.all([
    safeFetch(`${API_URL}/api/wine-requests`),
    safeFetch(`${API_URL}/api/borrow-return/open/inventory`),
  ]);
  const wineItemIds = new Set(wineReqs.map(r => r.inventory_gen_id));
  const borrowedIds = new Set(invBorrows.filter(b => b.status === 'BORROWED').map(b => b.record_id));

  // ── Step 1: Search ──
  let filtered = searchQuery
    ? allItems.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery) ||
        item.category.toLowerCase().includes(searchQuery) ||
        (item.location_name && item.location_name.toLowerCase().includes(searchQuery))
      )
    : allItems;

  // ── Step 2: Category filter ──
  if (activeCategory !== 'all') {
    filtered = filtered.filter(item => item.category === activeCategory);
  }

  // ── Step 3: Unit filter ──
  if (activeUnit !== 'all') {
    filtered = filtered.filter(item => item.unit === activeUnit);
  }

  // ── Step 3b: Location filter ──
  if (activeLocation !== 'all') {
    filtered = filtered.filter(item => item.location_name === activeLocation);
  }

  // ── Step 4: Status filter ──
  if (activeStatus === 'low') {
    filtered = filtered.filter(item => item.current_quantity <= item.reorder_level);
  } else if (activeStatus === 'active') {
    filtered = filtered.filter(item => item.current_quantity > item.reorder_level);
  }

  // ── Step 5: Sort — low stock floats to top, then A–Z within each group ──
  filtered.sort((a, b) => {
    const aLow = a.current_quantity <= a.reorder_level ? 0 : 1;
    const bLow = b.current_quantity <= b.reorder_level ? 0 : 1;
    if (aLow !== bLow) return aLow - bLow;
    return a.item_name.localeCompare(b.item_name);
  });

  // ── Step 6: Pagination slice ──
  const totalItems = filtered.length;
  const start = (currentInvPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);

  const tbody = document.getElementById("inv-tbody");
  tbody.innerHTML = "";

  const low = filtered.filter(item => item.current_quantity <= item.reorder_level).length;

  paginated.forEach(item => {
    const isLow = item.current_quantity <= item.reorder_level;

    const tr = document.createElement("tr");
    tr.className = isLow ? "tr-clickable tr-warn" : "tr-clickable";

    tr.addEventListener("click", () => {
      openDP("inventory", item.inventory_gen_id, tr);
    });

    // ✅ NEW: pending-request / borrowed indicator badge
    let requestBadge = '';
    if (wineItemIds.has(item.inventory_gen_id)) {
      requestBadge = '<span class="badge b-amber" style="margin-left:4px">🍷 Pending Request</span>';
    } else if (borrowedIds.has(item.inventory_gen_id)) {
      requestBadge = '<span class="badge b-blue" style="margin-left:4px">📤 Borrowed</span>';
    }

    tr.innerHTML = `
      <td>${item.item_name}</td>
      <td>${item.category}</td>
      <td>${item.current_quantity}</td>
      <td>${item.unit || "-"}</td>
      <td>${item.location_name || "-"}</td>
      <td>
        ${isLow
          ? '<span class="badge b-red">Low Stock</span>'
          : '<span class="badge b-green">Active</span>'
        }
        ${requestBadge}
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("inv-low-ct").innerText = low + " low stock";
  document.getElementById("inv-total-ct").innerText = totalItems + " items";

  renderPagination(totalItems);
}

/* ════════════════ IT SUPPLIES TABLE — borrowed badge ════════════════ */

async function _renderITTable() {
  const filtered  = _filterIT(_allITSupplies);
  const total     = filtered.length;
  const start     = (currentITPage - 1) * itPerPage;
  const paginated = filtered.slice(start, start + itPerPage);

  // ✅ NEW: which IT supply items are currently borrowed
  const itBorrows = await safeFetch(`${API_URL}/api/borrow-return/open/itsupplies`);
  const borrowedIds = new Set(itBorrows.filter(b => b.status === 'BORROWED').map(b => b.record_id));

  const tbody = document.getElementById('it-tbody');
  tbody.innerHTML = '';

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--slate-400)">No IT supplies found.</td></tr>`;
  } else {
    paginated.forEach(it => {
      const statusCls = {
        Available: 'b-green',
        'In Use':  'b-blue',
        Damaged:   'b-red'
      }[it.status] || 'b-slate';

      // ✅ NEW: borrowed indicator badge
      const requestBadge = borrowedIds.has(it.it_supplies_id)
        ? '<span class="badge b-blue" style="margin-left:4px">📤 Borrowed</span>'
        : '';

      const tr = document.createElement('tr');
      tr.className = 'tr-clickable';
      tr.innerHTML = `
        <td class="td-strong">${it.asset_name}</td>
        <td class="td-mono">${it.serial_number || '—'}</td>
        <td>${it.quantity}</td>
        <td>${_warrantyBadge(it.warranty_end_date)}</td>
        <td>${it.location_name || '—'}</td>
        <td>${it.status ? `<span class="badge ${statusCls}">${it.status}</span>` : '—'}${requestBadge}</td>
      `;
      tr.addEventListener('click', () => openDP('itsupplies', it.it_supplies_id, tr));
      tbody.appendChild(tr);
    });
  }

  document.getElementById('it-total-ct').textContent = `${total} items`;
  _renderITPagination(total);
}

/* ════════════════ DASHBOARD — Panel 1 merged with pending requests ════════════════
   Full copy of refreshDashboard() from vehicle_dashboard_alert_patch.js —
   every panel except Panel 1 is unchanged (Part 5's vehicle-plan alert
   fix is preserved below in Panel 4). ════════════════════════════════════ */

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
