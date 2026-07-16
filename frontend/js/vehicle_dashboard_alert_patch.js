/* ============================================================
   vehicle_dashboard_alert_patch.js — Part 5
   ============================================================
   ROOT CAUSE: refreshDashboard()'s "PANEL 4 — VEHICLE ALERTS" only
   ever checked the vehicle record's own legacy fields
   (v.maintenance_threshold / v.last_maintenance_km / v.odometer) —
   it never fetched each vehicle's actual maintenance PLANS
   (vehicle_maintenance_types, via GET /api/vehicle-plans/:vehicle_id),
   which is where time-based (Monthly/Yearly) plans — and per-plan
   odometer plans — actually live. So a plan sitting at "Overdue" or
   "Due Soon" in the Vehicle module's own detail panel never surfaced
   on the Dashboard at all.

   FIX: this is a full re-implementation of refreshDashboard(),
   IDENTICAL to laptop_dashboard_patches.js's version except for
   PANEL 4, which now also fetches each vehicle's plans (via the
   already-loaded fetchPlansForVehicle()/planOdoStatus()/
   planTimeStatus() helpers from vehicles_enhanced.js) and adds an
   alert row per plan that is due_soon or overdue — for BOTH
   odometer-based and time-based plans.

   Load AFTER laptop_dashboard_patches.js (last-loaded wins, same
   pattern as every other patch file in this project) and AFTER
   vehicles_enhanced.js (for fetchPlansForVehicle/planOdoStatus/
   planTimeStatus).
   ============================================================ */

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

  /* ── STAT CARDS (unchanged) ─────────────────── */
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

  /* ── PANEL 1 — LOW STOCK (unchanged) ──────── */
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

  /* ── PANEL 4 — VEHICLE ALERTS ✅ FIXED (Part 5) ─────────────
     Now covers BOTH:
       (a) the legacy vehicle-record threshold (unchanged, kept for
           vehicles that don't use the newer plans system), AND
       (b) each vehicle's actual maintenance PLANS — odometer-based
           AND time-based (Monthly/Yearly) — which is where "Due
           Soon"/"Overdue" is actually computed but was never
           queried by the dashboard before.
  ────────────────────────────────────────────────────────────── */
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

    // (a) legacy threshold on the vehicle record itself
    const kmUsed = (v.odometer || 0) - (v.last_maintenance_km || 0);
    const threshold = v.maintenance_threshold || 1000;
    if (kmUsed >= threshold) {
      vehicleAlerts.push({ v, reason: `${kmUsed} km since last service`, cls: 'red' });
    }

    // ✅ NEW (Part 5): (b) per-plan odometer + time-based alerts
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
