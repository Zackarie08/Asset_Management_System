/* ============================================================
   laptop_dashboard_patches.js
   ============================================================
   Loaded AFTER main.js (and after users.js) in index.html:

       <script src="js/main.js"></script>
       <script src="js/users.js"></script>
       <script src="js/exports.js"></script>
       <script src="js/laptop_dashboard_patches.js"></script>

   All classic <script> tags on a page share ONE global scope.
   Function declarations made here with the same name as a
   function already declared in main.js OVERRIDE it, because:
     • Any code that calls a function by its bare name (onclick
       handlers, other functions, setInterval callbacks) resolves
       that name in the shared global scope AT CALL TIME — so it
       picks up whichever declaration loaded last.
     • The one exception is anything that captured a direct
       function REFERENCE into a data structure before this file
       loaded (main.js's DP_RENDERERS map does this for dpLaptop).
       For that one case we explicitly re-point the map entry at
       the bottom of this file.

   This approach lets us fix/extend the Laptop module and the
   Dashboard without re-shipping the entire (2,500+ line) main.js
   file and risking transcription errors in unrelated code.
   See Laptop_Module_Enhancements.md and
   Dashboard_Scrollable_Sections_Report.md for the full writeup.
   ============================================================ */


/* ════════════════════════════════════════════════════════════
   PART 4 — DASHBOARD: remove fixed item limits, allow scrolling
   ════════════════════════════════════════════════════════════
   ROOT CAUSE: refreshDashboard() in main.js hard-slices every
   panel's data to a fixed count before rendering — e.g.
   lowStock.slice(0, 6), activeOrders.slice(0, 6),
   laptopAlerts.slice(0, 5), vehicleAlerts.slice(0, 5),
   pendingContractRequests.slice(0, 5), contractAlerts.slice(0, 5),
   allSubAlerts.slice(0, 5). Any records beyond that count are
   simply never turned into DOM nodes, so no amount of CSS can
   reveal them — this had to be fixed in JS.

   FIX: this is a full re-implementation of refreshDashboard()
   with every `.slice(0, N)` removed so ALL matching records are
   rendered. The corresponding CSS change (style.css) gives each
   list panel a fixed max-height + overflow-y: auto so the CARD
   size on the dashboard does not grow — it scrolls internally
   instead. See style.css patch: #dash-low-list, #dash-order-list,
   #dash-maint-list, #dash-veh-list, #dash-con-list,
   #dash-admin-list.
   ════════════════════════════════════════════════════════════ */
async function refreshDashboard() {

  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

  const [inventory, orders, laptops, vehicles, contracts, logs, globe, m365, contractRequests] =
    await Promise.all([
      safeFetch(`${API_URL}/api/inventory`),
      safeFetch(`${API_URL}/api/po`),
      safeFetch(`${API_URL}/api/laptops`),
      safeFetch(`${API_URL}/api/vehicle`),
      safeFetch(`${API_URL}/api/contracts`),
      safeFetch(`${API_URL}/api/logs`),
      safeFetch(`${API_URL}/api/globe`),
      safeFetch(`${API_URL}/api/m365`),
      safeFetch(`${API_URL}/api/contracts/requests`),
    ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /* ── STAT CARDS (unchanged from main.js) ─────────────────── */
  const totalInv       = inventory.length;
  const lowStock        = inventory.filter(i => i.current_quantity <= i.reorder_level);
  const activeLaptops   = laptops.filter(l => l.status === 'Active');
  const pendingOrders   = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');

  _setText('dc-total',    totalInv);
  _setText('dc-total-d',  `${totalInv} tracked items`);
  _setText('dc-low',      lowStock.length);
  _setText('dc-low-d',    lowStock.length ? `${lowStock.length} item${lowStock.length > 1 ? 's' : ''} need restocking` : 'All stocks OK');
  _setText('dc-laptops',   activeLaptops.length);
  _setText('dc-laptops-d', `${activeLaptops.length} of ${laptops.length} active`);
  _setText('dc-orders',   pendingOrders.length);
  _setText('dc-orders-d', pendingOrders.length ? `${pendingOrders.length} pending` : 'No pending orders');

  /* ── PANEL 1 — LOW STOCK (✅ shows ALL, scrollable) ──────── */
  _setText('dash-low-ct', `${lowStock.length} items`);
  if (lowStock.length === 0) {
    _setHTML('dash-low-list', _emptyMsg('All inventory levels are OK'));
  } else {
    const rows = lowStock.map(i => {
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
    _setHTML('dash-low-list', rows);
  }

  /* ── PANEL 2 — PENDING / DELAYED ORDERS (✅ ALL, scrollable) ── */
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
    _setHTML('dash-order-list', _emptyMsg('📦 No pending orders'));
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
            <div class="pr-meta">PO #${o.purchase_order_id} · ETA: ${o.expected_delivery_date || '—'}</div>
          </div>
          ${badge(s, bdgCls)}
        </div>`;
    }).join('');
    _setHTML('dash-order-list', rows);
  }

  /* ── PANEL 3 — LAPTOP ALERTS (✅ ALL, scrollable) ─────────── */
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const isMaintenanceMonth = currentMonth === 6 || currentMonth === 12;

  const laptopAlerts = [];
  laptops.forEach(lp => {
    if (lp.status === 'For Repair') { laptopAlerts.push({ lp, reason: 'For Repair', cls: 'red' }); return; }
    if (!lp.current_user_id) { laptopAlerts.push({ lp, reason: 'Unassigned', cls: 'amber' }); return; }
    if (lp.date_of_purchase) {
      const ageYears = (now - new Date(lp.date_of_purchase)) / (365.25 * 24 * 3600 * 1000);
      if (ageYears >= 3 && lp.user_role === 'intern') {
        laptopAlerts.push({ lp, reason: `${Math.floor(ageYears)}y old · Intern`, cls: 'amber' });
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
      html += laptopAlerts.map(({ lp, reason, cls }) => `
        <div class="panel-row">
          <div class="pr-dot ${cls}"></div>
          <div style="flex:1">
            <div class="pr-name">${_esc(lp.item_description)}</div>
            <div class="pr-meta">${_esc(lp.asset_number)} · ${_esc(lp.user_name || 'Unassigned')}</div>
          </div>
          ${badge(reason, `b-${cls}`)}
        </div>`).join('');
    }
    _setHTML('dash-maint-list', html);
  }

  /* ── PANEL 4 — VEHICLE ALERTS (✅ ALL, scrollable) ────────── */
  const isFirstWorkingDay = (() => {
    const d = now.getDay();
    const day = now.getDate();
    return day <= 3 && d !== 0 && d !== 6;
  })();

  const vehicleAlerts = [];
  vehicles.forEach(v => {
    if (v.status === 'UNDER_MAINTENANCE') { vehicleAlerts.push({ v, reason: 'Under Maintenance', cls: 'blue' }); return; }
    const kmUsed = (v.odometer || 0) - (v.last_maintenance_km || 0);
    const threshold = v.maintenance_threshold || 1000;
    if (kmUsed >= threshold) vehicleAlerts.push({ v, reason: `${kmUsed} km since last service`, cls: 'red' });
  });

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

  /* ── PANEL 5 — CONTRACTS (✅ ALL, scrollable) ─────────────── */
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

  /* ── PANEL 6 — ADMIN: GLOBE + M365 (✅ ALL, scrollable) ───── */
  const adminPanel = document.getElementById('dash-admin-wrap');
  if (adminPanel) adminPanel.style.display = isAdminUser() ? '' : 'none';

  if (isAdminUser()) {
    const globeAlerts = globe.filter(g => {
      if (g.status === 'Inactive') return false;
      const d = daysFromNow(g.renewal_date);
      return d !== null && d <= 7;
    });
    const m365Alerts = m365.filter(m => {
      const d = daysFromNow(m.expiry_date);
      return d !== null && d <= 7;
    });
    const totalSubs = globe.filter(g => g.status === 'Active').length + m365.filter(m => m.status === 'Active').length;

    _setText('dash-admin-ct', `${globeAlerts.length + m365Alerts.length} alerts`);
    _setText('dash-admin-subs', `${totalSubs} active subscriptions`);

    const allSubAlerts = [
      ...globeAlerts.map(g => ({ name: g.employee_name, detail: `Globe · ${g.plan_name || '—'} · Renews ${g.renewal_date || '—'}`, daysLeft: daysFromNow(g.renewal_date) })),
      ...m365Alerts.map(m => ({ name: m.assigned_email, detail: `M365 · ${m.license_type || '—'} · Expires ${m.expiry_date || '—'}`, daysLeft: daysFromNow(m.expiry_date) })),
    ];

    if (allSubAlerts.length === 0) {
      _setHTML('dash-admin-list', _emptyMsg('✅ No subscription alerts'));
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


/* ════════════════════════════════════════════════════════════
   PART 3 — LAPTOP MODULE ENHANCEMENTS
   ════════════════════════════════════════════════════════════ */

/* ── F. Table: show Employee Name (not user_id), "Unassigned"
   badge when unset. The backend already LEFT JOINs users and
   returns `user_name` — the old _renderLpTable() just never
   used it and rendered lp.current_user_id instead. ────────── */
async function _renderLpTable() {
  const myToken = ++_lpRenderToken;

  const filtered  = _filterLaptops(_allLaptops);
  const total     = filtered.length;
  const start     = (currentLpPage - 1) * lpPerPage;
  const paginated = filtered.slice(start, start + lpPerPage);

  if (paginated.length === 0) {
    if (myToken !== _lpRenderToken) return;
    const tbody = document.getElementById('lp-tbody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--slate-400)">No laptops found.</td></tr>`;
    document.getElementById('lp-ct').textContent = `${total} units`;
    _renderLpPagination(total);
    return;
  }

  const maintResults = await Promise.all(
    paginated.map(lp =>
      fetch(`${API_URL}/api/laptop-maintenance/${lp.laptop_id}`).then(r => r.json()).catch(() => [])
    )
  );

  if (myToken !== _lpRenderToken) return;

  const tbody = document.getElementById('lp-tbody');
  tbody.innerHTML = '';

  paginated.forEach((lp, i) => {
    const sCls = { Active: 'b-green', 'For Repair': 'b-red', Disposed: 'b-slate' }[lp.status] || 'b-slate';
    const maintStatus = _lpMaintenanceStatus(maintResults[i]);

    // ✅ FIX (Part 3-F): employee name instead of raw user_id,
    // with an "Unassigned" badge (same visual language as
    // other status badges in the system) when there is none.
    const assignedCell = lp.current_user_id
      ? _escVeh_lp(lp.user_name || `User #${lp.current_user_id}`)
      : `<span class="badge b-slate">Unassigned</span>`;

    const tr = document.createElement('tr');
    tr.className = 'tr-clickable';
    tr.innerHTML = `
      <td>${lp.asset_number}</td>
      <td>${lp.serial_number}</td>
      <td>${assignedCell}</td>
      <td>${badge(lp.status, sCls)}</td>
      <td>${_warrantyBadge(lp.warranty_end_date)}</td>
      <td>${_lpMaintenanceBadge(maintStatus)}</td>
    `;
    tr.addEventListener('click', () => openDP('laptop', lp.laptop_id, tr));
    tbody.appendChild(tr);
  });

  document.getElementById('lp-ct').textContent = `${total} units`;
  _renderLpPagination(total);
}

// tiny local escaper (mirrors _esc()/`_escVeh` used elsewhere) so this
// file has no load-order dependency on any one module's private helper
function _escVeh_lp(str) {
  if (!str) return '—';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── A/B/C. Detail panel: show Remarks + Supplier, add
   "Remove Current User" action next to Assign. ─────────────── */
async function dpLaptop(id, useCache = false) {
  let data, history, maintenance;

  if (!useCache || !cachedLp) {
    const res = await fetch(`${API_URL}/api/laptops`);
    data = await res.json();
    const histRes = await fetch(`${API_URL}/api/laptops/${id}/history`);
    history = await histRes.json();
    const maintRes = await fetch(`${API_URL}/api/laptop-maintenance/${id}`);
    maintenance = await maintRes.json();

    const lp = data.find(x => x.laptop_id === id);
    if (!lp) return;

    cachedLp = lp;
    cachedHistory = history;
    cachedMaintenance = maintenance;
  } else {
    data = [cachedLp];
    history = cachedHistory;
    maintenance = cachedMaintenance;
  }

  const lp = cachedLp;

  const purchaseDate = new Date(lp.date_of_purchase);
  const ageYears = Math.floor((new Date() - purchaseDate) / (365.25 * 24 * 3600 * 1000));
  const isIntern = lp.user_role === "intern";
  const needsReplace = ageYears >= 3 && !isIntern;

  setDPHeader('💻', '#f0fdf4', lp.asset_number, lp.serial_number);

  const now = new Date();
  const month = now.getMonth() + 1;
  const isMaintenanceMonth = (month === 6 || month === 12);
  const hasCheckThisMonth = maintenance.some(m => {
    const d = new Date(m.check_date);
    return d.getMonth() + 1 === month && d.getFullYear() === now.getFullYear();
  });
  const showMaintenanceAlert = isMaintenanceMonth && !hasCheckThisMonth;

  let histHTML = history.length ? `
      <ul class="mh-list">
        ${history.map(h => `
          <li class="mh-item">
            <div class="mh-dot good"></div>
            <div>
              <div class="mh-cond info">${h.previous_user_name || 'Unassigned'} → ${h.new_user_name || 'Unassigned'}</div>
              <div class="mh-date">${new Date(h.date_changed).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</div>
              <div class="mh-remarks">${h.remarks || 'User assignment update'}</div>
            </div>
          </li>`).join('')}
      </ul>` : `<div style="text-align:center;padding:16px;color:var(--slate-400);font-size:12px">No assignment history yet.</div>`;

  let maintHTML = maintenance.length ? `
      <ul class="mh-list">
        ${maintenance.map(m => `
          <li class="mh-item">
            <div class="mh-dot good"></div>
            <div>
              <div class="mh-cond info">${m.condition}</div>
              <div class="mh-date">${new Date(m.check_date).toLocaleDateString()}</div>
              <div class="mh-remarks">${m.remarks || "No remarks"}</div>
            </div>
          </li>`).join('')}
      </ul>` : `<div style="text-align:center;padding:16px;color:var(--slate-400);font-size:12px">No technical check records yet.</div>`;

  const html = `
    <div class="dp-section">
      ${showMaintenanceAlert ? `<div class="dp-alert warning">⚠️ Technical Check required this month (June/December)</div>` : ""}
      ${needsReplace ? `<div class="dp-alert danger">⚠️ Laptop is ${ageYears} years old — needs replacement</div>` : ""}
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">💻 Device Info</div>
      <div class="dp-grid">
        ${dpField("Asset Number", lp.asset_number)}
        ${dpField("Serial Number", lp.serial_number || '-')}
        ${dpField("Brand", lp.category)}
        ${dpField("Supplier", lp.supplier || '—')}
        ${dpField("Price", lp.price ? '₱' + lp.price : '-')}
        ${dpField("Status", lp.status)}
      </div>
    </div>
    <div class="dp-section">
      ${dpField("Description", lp.item_description)}
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📅 Dates</div>
      <div class="dp-grid">
        ${dpField("Purchased", lp.date_of_purchase || '-')}
        ${dpField("Warranty", lp.warranty_end_date || '-')}
      </div>
    </div>

    ${lp.remarks ? `
    <div class="dp-section">
      <div class="dp-section-hd">📝 Remarks</div>
      <div class="dp-grid">${dpFieldFull('Notes', lp.remarks)}</div>
    </div>` : ''}

    <div class="dp-section">
      <div class="dp-section-hd">👤 Assignment</div>
      <div class="dp-grid">
        ${dpField("Assigned To", lp.user_name || "Unassigned")}
      </div>
    </div>

    ${isAdminUser() ? `
      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
          <button class="btn btn-green btn-sm" onclick="openAssign(${lp.laptop_id})">👤 Assign User</button>
          ${lp.current_user_id ? `
          <button class="btn btn-amber btn-sm" onclick="removeAssignedUser(${lp.laptop_id})">↩️ Remove Current User</button>
          ` : ''}
          <button class="btn btn-primary btn-sm" onclick="openMaint(${lp.laptop_id})">🔧 Technical Check</button>
          <button class="btn btn-outline btn-sm" onclick="editLaptop(${lp.laptop_id})">✏️ Edit</button>
          <button class="btn btn-red btn-sm" onclick="deleteLaptop(${lp.laptop_id})">🗑️ Delete</button>
        </div>
      </div>
    ` : ""}

    <div class="dp-section">
      <div class="dp-section-hd" onclick="toggleAssignHistory()">📜 Assignment History ${showAssignHistory ? "▲" : "▼"}</div>
      ${showAssignHistory ? histHTML : ""}
    </div>

    <div class="dp-section">
      <div class="dp-section-hd" onclick="toggleMaintHistory()">🔧 Technical Check History ${showMaintHistory ? "▲" : "▼"}</div>
      ${showMaintHistory ? maintHTML : ""}
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}
// dpLaptop is stored by reference inside DP_RENDERERS (built when
// main.js first ran), so we must re-point that entry at our new
// version — redeclaring the function alone would not affect the
// already-captured reference in that map.
if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.laptop = dpLaptop;


/* ── A/B/E. Create/Edit: Remarks + Supplier fields, and the
   creation log now cites Serial Number instead of Asset Number. ── */
function saveLaptop() {
  const asset     = document.getElementById('lp-f-asset').value.trim();
  const desc      = document.getElementById('lp-f-desc').value.trim();
  const serial    = document.getElementById('lp-f-serial').value.trim();
  const brand     = document.getElementById('lp-f-brand').value;
  const location  = document.getElementById('lp-f-location').value;
  const status    = document.getElementById('lp-f-status').value;
  const warranty  = document.getElementById('lp-f-warranty').value;
  const bought    = document.getElementById('lp-f-bought').value;
  const price     = document.getElementById('lp-f-price').value;
  const remarks   = document.getElementById('lp-f-remarks')?.value || '';               // ✅ NEW
  const supplier  = (document.getElementById('lp-f-supplier')?.value || '').trim();      // ✅ NEW

  if (!asset || !desc || !serial || !brand || !location || !status || !bought) {
    showToast("Please fill all required fields", "t-error");
    return;
  }

  const payload = {
    asset_number: asset,
    item_description: desc,
    serial_number: serial,
    category: brand,
    price: parseFloat(price) || null,
    current_user_id: null,
    current_location: parseInt(location),
    status,
    warranty_end_date: warranty || null,
    date_of_purchase: bought,
    remarks,                 // ✅ NEW
    supplier                 // ✅ NEW
  };

  const url    = editLaptopId ? `${API_URL}/api/laptops/${editLaptopId}` : `${API_URL}/api/laptops`;
  const method = editLaptopId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(() => {
    const isEdit = !!editLaptopId;
    showToast(isEdit ? "Laptop updated" : "Laptop added", "t-success");

    // ✅ FIX (Part 3-E): log now cites Serial Number, not Asset Number
    addLog(
      isEdit ? "UPDATE" : "CREATE",
      "LAPTOP",
      isEdit
        ? `Updated Laptop - Serial No: ${serial}`
        : `Created Laptop - Serial No: ${serial}`,
      editLaptopId || serial
    );
    closeM('m-add-lp');
    renderLaptops();
    editLaptopId = null;
  });
}

async function editLaptop(id) {
  const res = await fetch(`${API_URL}/api/laptops`);
  const data = await res.json();
  const lp = data.find(x => x.laptop_id === id);
  if (!lp) return;

  editLaptopId = id;
  openM("m-add-lp");
  const title = document.querySelector('#m-add-lp .modal-title');
  if (title) title.textContent = "💻 Edit Laptop";

  // ✅ FIX: await the dropdown fetch instead of racing it with setTimeout —
  // the old code sometimes left "Location" blank on slower connections.
  await loadLocationsDropdown();

  document.getElementById('lp-f-asset').value = lp.asset_number;
  document.getElementById('lp-f-desc').value = lp.item_description;
  document.getElementById('lp-f-serial').value = lp.serial_number;
  document.getElementById('lp-f-brand').value = lp.category;
  document.getElementById('lp-f-location').value = lp.current_location;
  document.getElementById('lp-f-status').value = lp.status;
  document.getElementById('lp-f-warranty').value = formatDateForInput(lp.warranty_end_date);
  document.getElementById('lp-f-bought').value = formatDateForInput(lp.date_of_purchase);
  document.getElementById('lp-f-price').value = lp.price || "";
  const remarksEl = document.getElementById('lp-f-remarks');
  if (remarksEl) remarksEl.value = lp.remarks || '';
  const supplierEl = document.getElementById('lp-f-supplier');
  if (supplierEl) supplierEl.value = lp.supplier || '';

  renderLaptops();
}

/* ── C/D. Assign / Unassign flow with improved logs. ─────────
   openAssign() now also shows who currently holds the laptop
   and reveals a "Remove Current User" button inside the same
   modal when someone is assigned (see index.html patch:
   #assign-current-line / #assign-remove-btn). */
async function openAssign(id) {
  currentLpId = id;

  const res  = await fetch(`${API_URL}/api/laptops`);
  const data = await res.json();
  const lp   = data.find(x => x.laptop_id === id);

  document.getElementById('assign-lp-name').textContent =
    lp ? `${lp.asset_number} (SN: ${lp.serial_number})` : `Laptop ID: ${id}`;
  document.getElementById('assign-user').value = '';

  const currentLine = document.getElementById('assign-current-line');
  const removeBtn   = document.getElementById('assign-remove-btn');
  if (currentLine) {
    currentLine.textContent = lp && lp.current_user_id
      ? `Currently assigned to: ${lp.user_name || 'Unknown user'}`
      : 'Currently unassigned';
  }
  if (removeBtn) {
    removeBtn.style.display = (lp && lp.current_user_id) ? 'inline-flex' : 'none';
  }

  openM('m-assign');
  await loadAssignUsers();
}

function doAssign() {
  const userName = document.getElementById("assign-user").value;
  const user_id  = userMap[userName];

  if (!user_id) {
    showToast("Select a valid user", "t-error");
    return;
  }

  const lpLabel = cachedLp && cachedLp.laptop_id === currentLpId
    ? `${cachedLp.asset_number} (SN: ${cachedLp.serial_number})`
    : `Laptop #${currentLpId}`;

  fetch(`${API_URL}/api/laptops/assign/${currentLpId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_user_id: user_id })
  })
  .then(res => {
    if (!res.ok) throw new Error("Assign failed");
    showToast("Laptop assigned", "t-success");
    // ✅ FIX (Part 3-D): log now identifies the specific laptop
    addLog("UPDATE", "LAPTOP", `${lpLabel} assigned to ${userName}`, currentLpId);
    closeM("m-assign");
    renderLaptops();
    if (dpOpen && dpCurrentType === "laptop") dpLaptop(dpCurrentId);
  })
  .catch(err => {
    console.error(err);
    showToast("Error assigning laptop", "t-error");
  });
}

/* ── C. NEW: Remove Current User (unassign) ──────────────────
   Returns the laptop to Unassigned without touching history —
   the backend's PUT /assign/:id always writes a laptop_history
   row (previous_user_id → NULL), so the audit trail is kept. */
function removeAssignedUser(id) {
  const targetId  = id || currentLpId;
  const lp        = (cachedLp && cachedLp.laptop_id === targetId) ? cachedLp : null;
  const lpLabel   = lp ? `${lp.asset_number} (SN: ${lp.serial_number})` : `Laptop #${targetId}`;
  const prevUser  = lp ? (lp.user_name || 'the current user') : 'the current user';

  fetch(`${API_URL}/api/laptops/assign/${targetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_user_id: null })
  })
  .then(res => {
    if (!res.ok) throw new Error("Unassign failed");
    showToast("Laptop returned to Unassigned", "t-success");
    addLog("UPDATE", "LAPTOP", `${lpLabel} removed from ${prevUser} — now Unassigned`, targetId);
    closeM("m-assign");
    renderLaptops();
    if (dpOpen && dpCurrentType === "laptop" && dpCurrentId === targetId) dpLaptop(targetId);
  })
  .catch(err => {
    console.error(err);
    showToast("Error removing assignment", "t-error");
  });
}
