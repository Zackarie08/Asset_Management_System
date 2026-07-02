/* ============================================================
   vehicles_enhanced.js  —  THIRD PASS (AUDIT FIX)

   Changes from v2 (vehicles_enhanced.js SECOND PASS):
   • ✅ FIX: Restored saveVehicle() — was referenced by the
     "Add Vehicle" modal button but never defined anywhere.
   • ✅ FIX: Restored editVehicle(id) — referenced by dpVehicle()
     action row but never defined.
   • ✅ FIX: Restored deleteVehicle()/confirmDeleteVehicle() —
     referenced by dpVehicle() and the m-confirm-del modal but
     never defined.
   • ✅ FIX: Restored openUpdateOdo()/saveOdoUpdate() — referenced
     by dpVehicle() and the m-update-odo modal but never defined.
   • ✅ FIX: Restored completeMaintenance() — referenced by
     dpVehicle() action row but never defined.
   • ✅ FIX: openMaintenanceChecklist() / submitMaintenanceChecklist()
     now actually call PUT /api/vehicle/start-maint/:id so the
     vehicle record's status truly becomes UNDER_MAINTENANCE.
     Previously only maintenance-plan history was recorded, so
     status never changed and "Complete Maintenance" was
     unreachable.
   • ✅ FIX: Removed duplicate isAdminUser() — canonical version
     now lives only in main.js (loaded after this file).
   • ✅ FIX: Removed redundant `window.renderVehicles = renderVehicles`
     (renderVehicles is already a global function declaration).
   • ✅ FIX: Added vehSearchQuery / filter DOM wiring notes — see
     accompanying index.html changes for veh-search / veh-filter-*
     / veh-pagination elements that previously didn't exist.

   Everything else preserved from v2: maintenance plans fully
   wired, progress bars, checklist flow, attachments, exports.
   ============================================================ */

/* ─────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────── */
const VEH_PAGE_SIZE = 20;
let   vehCurrentPage = 1;
let   vehSearchQuery = '';
let   vehFilterStatus = 'all';
let   vehFilterType   = 'all';
let   vehFilterDue    = 'all';
let   _allVehicles    = [];
let   _allVehPlans    = {};   // { vehicle_id: [...plans] }

let planEditId    = null;
let planVehicleId = null;
let _recordMaintTypeId = null;
let _recordVehicleId   = null;

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
function _escVeh(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ✅ FIX: isAdminUser() duplicate removed from this file.
// The canonical definition lives in main.js (loaded after this
// file in index.html), so it is still available globally here.

function _daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

/* ─────────────────────────────────────────────────────────
   FETCH HELPERS
───────────────────────────────────────────────────────── */
async function fetchVehicles() {
  const res = await fetch(`${API_URL}/api/vehicle`);
  _allVehicles = await res.json();
  return _allVehicles;
}

async function fetchPlansForVehicle(vehicleId) {
  try {
    const res = await fetch(`${API_URL}/api/vehicle-plans/${vehicleId}`);
    const plans = await res.json();
    _allVehPlans[vehicleId] = plans;
    return plans;
  } catch { return []; }
}

/* ─────────────────────────────────────────────────────────
   PLAN STATUS HELPERS
───────────────────────────────────────────────────────── */
function planOdoStatus(plan, currentKm) {
  const remaining = (plan.next_due_km || 0) - currentKm;
  if (remaining <= 0)   return 'overdue';
  if (remaining <= 500) return 'due_soon';
  return 'ok';
}

function planTimeStatus(plan) {
  return plan.status_computed || 'unknown';
}

function worstPlanStatus(plans, currentKm) {
  let worst = 'ok';
  for (const p of plans) {
    const s = p.basis === 'odometer'
      ? planOdoStatus(p, currentKm)
      : planTimeStatus(p);
    if (s === 'overdue')  { worst = 'overdue'; break; }
    if (s === 'due_soon') worst = 'due_soon';
  }
  return worst;
}

/* ─────────────────────────────────────────────────────────
   TOP STATS
───────────────────────────────────────────────────────── */
async function refreshVehicleStats() {
  const vehicles = _allVehicles.length ? _allVehicles : await fetchVehicles();

  const total  = vehicles.length;
  const underM = vehicles.filter(v => v.status === 'UNDER_MAINTENANCE').length;

  // Compute due soon across all vehicles
  let dueSoon = 0;
  for (const v of vehicles) {
    const plans = _allVehPlans[v.vehicle_id] || [];
    const km    = v.odometer || 0;
    const ws    = worstPlanStatus(plans, km);
    if (ws === 'due_soon' || ws === 'overdue') dueSoon++;
  }

  _setVehStat('veh-stat-total',  total);
  _setVehStat('veh-stat-maint',  underM);
  _setVehStat('veh-stat-due',    dueSoon);
}

function _setVehStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ─────────────────────────────────────────────────────────
   MAIN RENDER — renderVehicles()
───────────────────────────────────────────────────────── */
async function renderVehicles() {
  // 1. Fetch vehicles + plans concurrently
  const vehicles = await fetchVehicles();

  await Promise.all(vehicles.map(async v => {
    if (!_allVehPlans[v.vehicle_id]) {
      await fetchPlansForVehicle(v.vehicle_id);
    }
  }));

  // 2. Update stats
  await refreshVehicleStats();

  // 3. Filter
  let filtered = vehicles.filter(v => {
    const km     = v.odometer || 0;
    const plans  = _allVehPlans[v.vehicle_id] || [];
    const ws     = worstPlanStatus(plans, km);

    const matchSearch = !vehSearchQuery ||
      v.vehicle_name.toLowerCase().includes(vehSearchQuery) ||
      v.plate_number.toLowerCase().includes(vehSearchQuery) ||
      v.type.toLowerCase().includes(vehSearchQuery);

    const matchStatus = vehFilterStatus === 'all' || v.status === vehFilterStatus;
    const matchType   = vehFilterType   === 'all' || v.type   === vehFilterType;

    let matchDue = true;
    if (vehFilterDue === 'due')     matchDue = ws === 'due_soon';
    if (vehFilterDue === 'overdue') matchDue = ws === 'overdue';
    if (vehFilterDue === 'ok')      matchDue = ws === 'ok';

    return matchSearch && matchStatus && matchType && matchDue;
  });

  // 4. Sort: overdue first, then due_soon, then rest A-Z
  filtered.sort((a, b) => {
    const order = { overdue: 0, due_soon: 1, ok: 2, unknown: 3 };
    const aW = worstPlanStatus(_allVehPlans[a.vehicle_id] || [], a.odometer || 0);
    const bW = worstPlanStatus(_allVehPlans[b.vehicle_id] || [], b.odometer || 0);
    if (order[aW] !== order[bW]) return order[aW] - order[bW];
    return a.vehicle_name.localeCompare(b.vehicle_name);
  });

  // 5. Pagination
  const total = filtered.length;
  const start = (vehCurrentPage - 1) * VEH_PAGE_SIZE;
  const page  = filtered.slice(start, start + VEH_PAGE_SIZE);

  // 6. Render rows
  const tbody = document.getElementById('veh-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  page.forEach(v => {
    const plans  = _allVehPlans[v.vehicle_id] || [];
    const km     = v.odometer || 0;
    const ws     = worstPlanStatus(plans, km);

    const maintBadge =
      v.status === 'UNDER_MAINTENANCE' ? `<span class="badge b-amber">🛠 Under Maint.</span>` :
      ws === 'overdue'                  ? `<span class="badge b-red">⚠️ Overdue</span>` :
      ws === 'due_soon'                 ? `<span class="badge b-amber">⚠️ Due Soon</span>` :
      plans.length > 0                  ? `<span class="badge b-green">✅ On Track</span>` :
                                          `<span class="badge b-slate">No Plans</span>`;

    // Next due label
    let nextLabel = '—';
    for (const p of plans) {
      if (p.basis === 'odometer') {
        const rem = (p.next_due_km || 0) - km;
        if (rem <= 1000) { nextLabel = `${p.name}: ${(p.next_due_km||0).toLocaleString()} km`; break; }
      } else {
        const s = planTimeStatus(p);
        if (s !== 'ok' && s !== 'unknown') { nextLabel = `${p.name}: ${p.next_due_date || 'soon'}`; break; }
      }
    }

    const tr = document.createElement('tr');
    tr.className = `tr-clickable${ws === 'overdue' ? ' tr-warn' : ''}`;
    tr.innerHTML = `
      <td class="td-strong">${_escVeh(v.vehicle_name)}</td>
      <td>${_escVeh(v.plate_number)}</td>
      <td>${_escVeh(v.type)}</td>
      <td>${km.toLocaleString()} km</td>
      <td style="font-size:11.5px;color:var(--slate-500)">${nextLabel}</td>
      <td>${maintBadge}</td>
    `;
    tr.addEventListener('click', () => openDP('vehicle', v.vehicle_id, tr));
    tbody.appendChild(tr);
  });

  _setVehStat('veh-ct', `${total} vehicles`);
  renderVehPagination(total);
}

/* ─────────────────────────────────────────────────────────
   PAGINATION
───────────────────────────────────────────────────────── */
function renderVehPagination(total) {
  const container = document.getElementById('veh-pagination');
  if (!container) return;

  const totalPages = Math.ceil(total / VEH_PAGE_SIZE);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = vehCurrentPage === 1;
  prev.onclick = () => { vehCurrentPage--; renderVehicles(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = `btn btn-xs pg-btn ${i === vehCurrentPage ? 'btn-primary' : 'btn-outline'}`;
    btn.textContent = i;
    btn.onclick = () => { vehCurrentPage = i; renderVehicles(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = vehCurrentPage === totalPages;
  next.onclick = () => { vehCurrentPage++; renderVehicles(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

/* ─────────────────────────────────────────────────────────
   FILTER / SEARCH HANDLERS
───────────────────────────────────────────────────────── */
function applyVehFilters() {
  vehFilterStatus = document.getElementById('veh-filter-status')?.value || 'all';
  vehFilterType   = document.getElementById('veh-filter-type')?.value   || 'all';
  vehFilterDue    = document.getElementById('veh-filter-due')?.value    || 'all';
  vehCurrentPage  = 1;
  renderVehicles();
}

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('veh-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      vehSearchQuery = searchInput.value.trim().toLowerCase();
      vehCurrentPage = 1;
      renderVehicles();
    });
  }
});

/* ─────────────────────────────────────────────────────────
   DETAIL PANEL — dpVehicle()
───────────────────────────────────────────────────────── */
async function dpVehicle(id) {
  // Fetch fresh data
  const [vRes, maintRes] = await Promise.all([
    fetch(`${API_URL}/api/vehicle`).then(r => r.json()),
    fetch(`${API_URL}/api/vehicle/maintenance/${id}`).then(r => r.json()).catch(() => []),
  ]);

  const v = vRes.find(x => x.vehicle_id === id);
  if (!v) return;

  const plans   = await fetchPlansForVehicle(id);
  const km      = v.odometer || 0;
  const threshold = v.maintenance_threshold || 1000;
  const kmUsed  = km - (v.last_maintenance_km || 0);
  const pct     = Math.min(100, Math.round((kmUsed / threshold) * 100));

  setDPHeader('🚗', '#eff6ff', v.vehicle_name, `${v.type} · ${v.plate_number}`);

  /* ── Maintenance Plans HTML ── */
  const plansHTML = _buildPlansHTML(plans, km, id);

  /* ── Maintenance History HTML ── */
  let maintHTML = maintRes.length
    ? maintRes.map(m => `
        <div style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;font-weight:700">${_escVeh(m.service_type)}</span>
            <span class="badge b-slate" style="font-family:var(--mono);font-size:10px">${m.maintenance_date || '—'}</span>
          </div>
          <div style="display:flex;gap:16px;font-size:11.5px;color:var(--slate-500)">
            <span>📏 ${m.odometer ? m.odometer.toLocaleString() + ' km' : '—'}</span>
            <span>💰 ${m.maintenance_cost ? '₱' + Number(m.maintenance_cost).toLocaleString() : '—'}</span>
          </div>
          ${m.remarks ? `<div style="font-size:12px;color:var(--slate-600);margin-top:4px">📝 ${_escVeh(m.remarks)}</div>` : ''}
        </div>`).join('')
    : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No maintenance history yet.</div>`;

  const html = `
    <!-- Vehicle Info -->
    <div class="dp-section">
      <div class="dp-section-hd">🚗 Vehicle Info</div>
      <div class="dp-grid">
        ${dpField('Plate Number', v.plate_number)}
        ${dpField('Type', v.type)}
        ${dpField('Status', v.status)}
        ${dpField('Odometer', km.toLocaleString() + ' km')}
        ${dpField('Last Maint. KM', (v.last_maintenance_km || 0).toLocaleString() + ' km')}
        ${dpField('Purchase Date', v.purchase_date || '—')}
        ${dpField('Price', v.price ? '₱' + Number(v.price).toLocaleString() : '—')}
        ${v.remarks ? dpFieldFull('Remarks', v.remarks) : ''}
      </div>
    </div>

    <!-- General KM Progress (legacy bar) -->
    <div class="dp-section">
      <div class="dp-section-hd">📊 General KM Usage</div>
      <div class="prog-bar-wrap">
        <div class="prog-bar-labels">
          <span>Since last service</span>
          <span>${kmUsed.toLocaleString()} / ${threshold.toLocaleString()} km</span>
        </div>
        <div class="prog-bar-track">
          <div class="prog-bar-fill" style="width:${pct}%;background:${
            pct >= 100 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
          }"></div>
        </div>
      </div>
    </div>

    <!-- Maintenance Plans -->
    <div class="dp-section" id="veh-plans-container-${id}">
      ${plansHTML}
    </div>

    <!-- Maintenance History -->
    <div class="dp-section">
      <div class="dp-section-hd">🔧 Maintenance History</div>
      ${maintHTML}
    </div>

    <!-- Attachments -->
    <div class="dp-section" id="veh-att-${id}"></div>

    <!-- Actions -->
    ${isAdminUser() ? `
      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
        ${v.status !== 'UNDER_MAINTENANCE' ? `
          <button class="btn btn-primary btn-sm" onclick="openMaintenanceChecklist(${v.vehicle_id})">
            🔧 Put Under Maintenance
          </button>
          <button class="btn btn-outline btn-sm" onclick="openUpdateOdo(${v.vehicle_id}, ${km}, '${_escVeh(v.plate_number)}')">
            📊 Update Odometer
          </button>
          ` : `
            <button class="btn btn-green btn-sm"
              onclick="completeMaintenance(${v.vehicle_id}, ${km}, '${_escVeh(v.plate_number)}')">
              ✅ Complete Maintenance
            </button>
          `}
          <button class="btn btn-outline btn-sm"
            onclick="editVehicle(${v.vehicle_id})">
            ✏️ Edit
          </button>
          <button class="btn btn-red btn-sm"
            onclick="deleteVehicle(${v.vehicle_id}, '${_escVeh(v.plate_number)}')">
            🗑️ Delete
          </button>
          <button class="btn btn-outline btn-sm"
            onclick="openAddPlan(${v.vehicle_id})">
            ➕ Add Plan
          </button>
        </div>
      </div>
    ` : ''}
  `;

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';

  // Load attachments panel
  attachmentPanel('vehicles', id, `veh-att-${id}`);
}

/* ─────────────────────────────────────────────────────────
   PLANS SECTION HTML BUILDER
───────────────────────────────────────────────────────── */
function _buildPlansHTML(plans, currentKm, vehicleId) {
  if (!plans.length) {
    return `
      <div class="dp-section-hd">⚙️ Maintenance Plans</div>
      <div style="color:var(--slate-400);font-size:12px;padding:8px 0">
        No maintenance plans set up yet.
      </div>
      ${isAdminUser() ? `
        <div class="dp-action-row" style="margin-top:8px">
          <button class="btn btn-outline btn-sm" onclick="openAddPlan(${vehicleId})">➕ Add Plan</button>
        </div>` : ''}`;
  }

  const planCards = plans.map(p => _buildSinglePlanCard(p, currentKm, vehicleId)).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="dp-section-hd" style="margin-bottom:0">⚙️ Maintenance Plans</div>
      ${isAdminUser() ? `<button class="btn btn-outline btn-xs" onclick="openAddPlan(${vehicleId})">➕ Add</button>` : ''}
    </div>
    ${planCards}`;
}

function _buildSinglePlanCard(plan, currentKm, vehicleId) {
  const isOdo  = plan.basis === 'odometer';
  const isTime = plan.basis === 'time';

  let statusBadge = '';
  let visualHTML  = '';

  if (isOdo) {
    const nextKm    = plan.next_due_km || 0;
    const lastKm    = plan.last_maintenance_km || 0;
    const interval  = plan.threshold_km || 1;
    const remaining = nextKm - currentKm;
    const pct       = Math.min(100, Math.max(0, Math.round(((currentKm - lastKm) / interval) * 100)));
    const barColor  = remaining <= 0 ? '#ef4444' : remaining <= 500 ? '#f59e0b' : '#22c55e';

    statusBadge = remaining <= 0
      ? `<span class="badge b-red">⚠️ Overdue (${Math.abs(remaining).toLocaleString()} km over)</span>`
      : remaining <= 500
        ? `<span class="badge b-amber">⚠️ Due Soon (${remaining.toLocaleString()} km)</span>`
        : `<span class="badge b-green">✅ OK (${remaining.toLocaleString()} km left)</span>`;

    visualHTML = `
      <div style="margin:8px 0">
        <div class="prog-bar-labels" style="display:flex;justify-content:space-between;font-size:11px;color:var(--slate-400);margin-bottom:4px">
          <span>Last: ${lastKm.toLocaleString()} km</span>
          <span>${pct}%</span>
          <span>Next: ${nextKm.toLocaleString()} km</span>
        </div>
        <div class="prog-bar-track">
          <div class="prog-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div style="font-size:11px;color:var(--slate-400);margin-top:3px">
          Current: ${currentKm.toLocaleString()} km · Interval: every ${interval.toLocaleString()} km
        </div>
      </div>`;

  } else if (isTime) {
    const s = plan.status_computed || 'unknown';
    const labelMap  = { overdue: '⚠️ Overdue', due_soon: '⚠️ Due Soon', ok: '✅ OK', pending: '⏳ Not Yet Done', unknown: '—' };
    const classMap  = { overdue: 'b-red', due_soon: 'b-amber', ok: 'b-green', pending: 'b-slate', unknown: 'b-slate' };
    statusBadge = `<span class="badge ${classMap[s] || 'b-slate'}">${labelMap[s] || s}</span>`;

    const daysLeft = _daysUntil(plan.next_due_date);
    let dueLabel = plan.next_due_date
      ? (daysLeft <= 0
          ? `⚠️ Was due ${plan.next_due_date}`
          : daysLeft <= 30
            ? `⚠️ Due in ${daysLeft} days (${plan.next_due_date})`
            : `🗓 Due: ${plan.next_due_date}`)
      : '⏳ Not yet performed';

    const intervalLabel = plan.interval_value
      ? `Every ${plan.interval_value} ${plan.interval_unit}(s)`
      : '—';

    visualHTML = `
      <div style="margin:8px 0;font-size:12px;color:var(--slate-600)">
        <div style="margin-bottom:3px">${dueLabel}</div>
        <div style="color:var(--slate-400)">${intervalLabel} · Last: ${
          plan.last_performed_date
            ? new Date(plan.last_performed_date).toLocaleDateString('en-PH', {month:'short',day:'numeric',year:'numeric'})
            : 'Never'
        }</div>
      </div>`;
  }

  return `
    <div style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700;color:var(--slate-800)">${_escVeh(plan.name)}</span>
        <span style="font-size:11px;color:var(--slate-400);text-transform:uppercase">${plan.basis}</span>
        ${statusBadge}
      </div>
      ${visualHTML}
      ${isAdminUser() ? `
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-xs btn-green"
            onclick="openRecordMaint(${vehicleId},'${_escVeh(plan.name)}',${plan.maint_type_id})">
            ✅ Perform
          </button>
          <button class="btn btn-xs btn-outline"
            onclick="openEditPlan(${plan.maint_type_id},${vehicleId})">
            ✏️
          </button>
          <button class="btn btn-xs btn-red"
            onclick="deletePlan(${plan.maint_type_id},${vehicleId})">
            🗑️
          </button>
        </div>` : ''}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   ✅ FIX — RESTORED: VEHICLE RECORD CRUD
   These functions were referenced by index.html (m-add-veh
   modal, m-confirm-del modal, m-update-odo modal) and by
   dpVehicle()'s action row, but were never defined anywhere
   in the codebase after the vehicles.js → vehicles_enhanced.js
   rewrite. Restored here, wired to the existing (and already
   working) backend endpoints in backend/routes/vehicle.js.
═══════════════════════════════════════════════════════════ */

let vehEditId = null;

/* ── ADD VEHICLE ─────────────────────────────────────────── */
// Called by: index.html #m-add-veh "✅ Add Vehicle" button
function saveVehicle() {
  const vehicle_name = document.getElementById('veh-f-name').value.trim();
  const type          = document.getElementById('veh-f-type').value;
  const plate_number  = document.getElementById('veh-f-plate').value.trim();
  const odometer      = document.getElementById('veh-f-odometer').value || 0;
  const purchase_date = document.getElementById('veh-f-date').value || null;
  const price         = document.getElementById('veh-f-price').value || null;
  const remarks       = document.getElementById('veh-f-remarks').value;

  if (!vehicle_name || !plate_number) {
    showToast('Vehicle name and plate number are required', 't-error');
    return;
  }

  const payload = {
    vehicle_name,
    plate_number,
    type,
    purchase_date,
    status: 'ACTIVE',
    price,
    remarks,
    odometer,
    last_maintenance_km: 0,
    maintenance_threshold: 1000,
  };

  const url    = vehEditId ? `${API_URL}/api/vehicle/${vehEditId}` : `${API_URL}/api/vehicle`;
  const method = vehEditId ? 'PUT' : 'POST';

  // PUT requires all fields — merge with existing record when editing
  const doSave = () => fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const finish = () => {
    showToast(vehEditId ? 'Vehicle updated' : 'Vehicle added', 't-success');
    addLog(vehEditId ? 'UPDATE' : 'CREATE', 'VEHICLE',
      `${vehEditId ? 'Updated' : 'Added'} vehicle: ${vehicle_name} (${plate_number})`, vehEditId || plate_number);
    const wasEdit = vehEditId;
    vehEditId = null;
    closeM('m-add-veh');
    renderVehicles();
    if (wasEdit && dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === wasEdit) dpVehicle(wasEdit);
  };

  if (vehEditId) {
    // Preserve fields not present in the add form (last_maintenance_km, maintenance_threshold, status)
    fetchVehicles().then(list => {
      const existing = list.find(v => v.vehicle_id === vehEditId);
      if (existing) {
        payload.status                 = existing.status;
        payload.last_maintenance_km    = existing.last_maintenance_km;
        payload.maintenance_threshold  = existing.maintenance_threshold;
      }
      doSave().then(res => { if (!res.ok) throw new Error('Save failed'); finish(); })
        .catch(() => showToast('Error saving vehicle', 't-error'));
    });
  } else {
    doSave().then(res => { if (!res.ok) throw new Error('Save failed'); finish(); })
      .catch(() => showToast('Error saving vehicle', 't-error'));
  }
}

/* ── EDIT VEHICLE ────────────────────────────────────────── */
// Called by: dpVehicle() action row "✏️ Edit" button
async function editVehicle(id) {
  const list = await fetchVehicles();
  const v = list.find(x => x.vehicle_id === id);
  if (!v) return;

  vehEditId = id;
  closeDP();
  openM('m-add-veh');

  document.getElementById('veh-f-name').value      = v.vehicle_name || '';
  document.getElementById('veh-f-type').value      = v.type || 'Car';
  document.getElementById('veh-f-plate').value     = v.plate_number || '';
  document.getElementById('veh-f-odometer').value  = v.odometer || 0;
  document.getElementById('veh-f-date').value      = v.purchase_date
    ? new Date(v.purchase_date).toISOString().slice(0, 10) : '';
  document.getElementById('veh-f-price').value     = v.price || '';
  document.getElementById('veh-f-remarks').value   = v.remarks || '';
}

/* ── DELETE VEHICLE ──────────────────────────────────────── */
// Called by: dpVehicle() action row "🗑️ Delete" button
//            + index.html #m-confirm-del modal "🗑️ Delete" button
let deleteVehicleId   = null;
let deleteVehiclePlate = '';

function deleteVehicle(id, plate) {
  deleteVehicleId    = id;
  deleteVehiclePlate = plate;
  openM('m-confirm-del');
}

function confirmDeleteVehicle() {
  fetch(`${API_URL}/api/vehicle/${deleteVehicleId}`, { method: 'DELETE' })
    .then(res => { if (!res.ok) throw new Error('Delete failed'); })
    .then(() => {
      showToast('Vehicle deleted', 't-warning');
      addLog('DELETE', 'VEHICLE', `Deleted vehicle: ${deleteVehiclePlate}`, deleteVehicleId);
      delete _allVehPlans[deleteVehicleId];
      closeM('m-confirm-del');
      closeDP();
      renderVehicles();
    })
    .catch(() => showToast('Error deleting vehicle', 't-error'));
}

/* ── UPDATE ODOMETER ─────────────────────────────────────── */
// Called by: dpVehicle() action row "📊 Update Odometer" button
//            + index.html #m-update-odo modal "Save" button
let _odoVehicleId = null;

function openUpdateOdo(id, currentKm, plate) {
  _odoVehicleId = id;
  const label = document.getElementById('uo-km');
  if (label) label.value = currentKm || 0;
  const title = document.querySelector('#m-update-odo .modal-title');
  if (title) title.textContent = `📊 Update Odometer — ${plate}`;
  openM('m-update-odo');
}

function saveOdoUpdate() {
  const odometer = parseInt(document.getElementById('uo-km').value);

  if (!odometer && odometer !== 0) {
    showToast('Enter a valid odometer reading', 't-error');
    return;
  }

  fetch(`${API_URL}/api/vehicle/update-odo/${_odoVehicleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ odometer }),
  })
  .then(res => { if (!res.ok) throw new Error('Update failed'); })
  .then(() => {
    showToast('Odometer updated', 't-success');
    addLog('UPDATE', 'VEHICLE', `Updated odometer to ${odometer.toLocaleString()} km`, _odoVehicleId);
    closeM('m-update-odo');
    renderVehicles();
    if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === _odoVehicleId) dpVehicle(_odoVehicleId);
  })
  .catch(() => showToast('Error updating odometer', 't-error'));
}

/* ── COMPLETE MAINTENANCE ────────────────────────────────── */
// Called by: dpVehicle() action row "✅ Complete Maintenance"
// button, shown when v.status === 'UNDER_MAINTENANCE'
function completeMaintenance(id, currentKm, plate) {
  const odometer = prompt(`Complete maintenance for ${plate}.\n\nConfirm current odometer (km):`, currentKm);
  if (odometer === null) return; // cancelled

  const parsedOdo = parseInt(odometer);
  if (isNaN(parsedOdo) || parsedOdo < 0) {
    showToast('Invalid odometer value', 't-error');
    return;
  }

  fetch(`${API_URL}/api/vehicle/complete-maint/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ odometer: parsedOdo }),
  })
  .then(res => { if (!res.ok) throw new Error('Failed'); })
  .then(() => {
    showToast('Maintenance completed — vehicle is now Active', 't-success');
    addLog('UPDATE', 'VEHICLE', `Completed maintenance for ${plate}`, id);
    renderVehicles();
    if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === id) dpVehicle(id);
  })
  .catch(() => showToast('Error completing maintenance', 't-error'));
}

/* ── EXPORT ────────────────────────────────────────────────
   (unchanged from v2, kept here for completeness)
───────────────────────────────────────────────────────── */
async function exportVehicles() {
  const vehicles = _allVehicles.length ? _allVehicles : await fetchVehicles();
  const headers  = ['Vehicle Name','Plate','Type','Odometer (km)','Status','Purchase Date'];
  const rows     = vehicles.map(v => [
    `"${v.vehicle_name}"`,`"${v.plate_number}"`,`"${v.type}"`,
    v.odometer || 0,`"${v.status}"`,`"${v.purchase_date || ''}"`
  ].join(','));

  const csv  = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Vehicles_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Vehicles exported', 't-success');
}

/* ─────────────────────────────────────────────────────────
   PLAN MODAL — ADD / EDIT
───────────────────────────────────────────────────────── */
function openAddPlan(vehicleId) {
  planEditId    = null;
  planVehicleId = vehicleId;
  _resetPlanForm();
  _setBasisUI(document.getElementById('plan-f-basis')?.value || 'odometer');
  openM('m-plan-add');
}

async function openEditPlan(maintTypeId, vehicleId) {
  planEditId    = maintTypeId;
  planVehicleId = vehicleId;
  try {
    const plans = await fetchPlansForVehicle(vehicleId);
    const plan  = plans.find(p => p.maint_type_id === maintTypeId);
    if (!plan) return;

    document.getElementById('plan-f-name').value  = plan.name   || '';
    document.getElementById('plan-f-basis').value = plan.basis  || 'odometer';
    _setBasisUI(plan.basis);

    if (plan.basis === 'odometer') {
      document.getElementById('plan-f-km').value      = plan.threshold_km        || '';
      document.getElementById('plan-f-last-km').value = plan.last_maintenance_km || '';
    } else {
      document.getElementById('plan-f-interval').value  = plan.interval_value    || '';
      document.getElementById('plan-f-unit').value      = plan.interval_unit     || 'month';
      document.getElementById('plan-f-last-date').value = plan.last_performed_date
        ? new Date(plan.last_performed_date).toISOString().slice(0,10) : '';
    }
    openM('m-plan-add');
  } catch { showToast('Failed to load plan', 't-error'); }
}

function _setBasisUI(basis) {
  const odoSection  = document.getElementById('plan-odo-section');
  const timeSection = document.getElementById('plan-time-section');
  if (odoSection)  odoSection.style.display  = basis === 'odometer' ? 'block' : 'none';
  if (timeSection) timeSection.style.display = basis === 'time'     ? 'block' : 'none';
}

function _resetPlanForm() {
  ['plan-f-name','plan-f-km','plan-f-last-km','plan-f-interval','plan-f-last-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const basisEl = document.getElementById('plan-f-basis');
  if (basisEl) basisEl.value = 'odometer';
  const unitEl = document.getElementById('plan-f-unit');
  if (unitEl) unitEl.value = 'month';
}

function savePlan() {
  const name  = document.getElementById('plan-f-name').value.trim();
  const basis = document.getElementById('plan-f-basis').value;
  if (!name) { showToast('Plan name is required', 't-error'); return; }

  const payload = { vehicle_id: planVehicleId, name, basis };

  if (basis === 'odometer') {
    const km     = parseInt(document.getElementById('plan-f-km').value);
    const lastKm = parseInt(document.getElementById('plan-f-last-km').value) || 0;
    if (!km || km <= 0) { showToast('Threshold KM is required', 't-error'); return; }
    payload.threshold_km        = km;
    payload.last_maintenance_km = lastKm;
  } else {
    const interval = parseInt(document.getElementById('plan-f-interval').value);
    const unit     = document.getElementById('plan-f-unit').value;
    const lastDate = document.getElementById('plan-f-last-date').value;
    if (!interval || interval <= 0) { showToast('Interval is required', 't-error'); return; }
    payload.interval_value      = interval;
    payload.interval_unit       = unit;
    payload.last_performed_date = lastDate || null;
  }

  const url    = planEditId ? `${API_URL}/api/vehicle-plans/${planEditId}` : `${API_URL}/api/vehicle-plans`;
  const method = planEditId ? 'PUT' : 'POST';

  fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); return r.json(); })
    .then(() => {
      showToast(planEditId ? 'Plan updated' : 'Plan added', 't-success');
      addLog(planEditId ? 'UPDATE' : 'CREATE', 'VEHICLE', `${planEditId ? 'Updated' : 'Added'} maintenance plan: ${name}`, planVehicleId);
      // Invalidate cached plans
      delete _allVehPlans[planVehicleId];
      planEditId = null;
      closeM('m-plan-add');
      renderVehicles();
      if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === planVehicleId) dpVehicle(planVehicleId);
    })
    .catch(err => showToast(err.message || 'Failed to save plan', 't-error'));
}

async function deletePlan(maintTypeId, vehicleId) {
  if (!confirm('Delete this maintenance plan?')) return;
  try {
    const res = await fetch(`${API_URL}/api/vehicle-plans/${maintTypeId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Plan deleted', 't-warning');
    addLog('DELETE', 'VEHICLE', `Deleted maintenance plan #${maintTypeId}`, vehicleId);
    delete _allVehPlans[vehicleId];
    renderVehicles();
    if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === vehicleId) dpVehicle(vehicleId);
  } catch { showToast('Failed to delete plan', 't-error'); }
}

/* ─────────────────────────────────────────────────────────
   RECORD MAINTENANCE AGAINST A PLAN
───────────────────────────────────────────────────────── */
function openRecordMaint(vehicleId, planName, maintTypeId) {
  _recordVehicleId   = vehicleId;
  _recordMaintTypeId = maintTypeId;

  const nameEl = document.getElementById('rec-maint-plan-name');
  if (nameEl) nameEl.textContent = planName;

  const dateEl = document.getElementById('rec-maint-date');
  if (dateEl) dateEl.value = todayStr();

  ['rec-maint-odo','rec-maint-cost','rec-maint-remarks'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  openM('m-record-maint');
}

function saveRecordMaint() {
  const odometer = document.getElementById('rec-maint-odo').value;
  const cost     = document.getElementById('rec-maint-cost').value;
  const remarks  = document.getElementById('rec-maint-remarks').value;
  const date     = document.getElementById('rec-maint-date').value;

  fetch(`${API_URL}/api/vehicle-plans/perform/${_recordMaintTypeId}`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      vehicle_id:       _recordVehicleId,
      odometer:         odometer || null,
      maintenance_cost: cost     || null,
      remarks,
      performed_date:   date     || null,
      performed_by:     currentUser?.name || null,
    }),
  })
  .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); return r.json(); })
  .then(() => {
    showToast('Maintenance recorded ✅', 't-success');
    addLog('UPDATE', 'VEHICLE', `Performed maintenance plan #${_recordMaintTypeId}`, _recordVehicleId);
    delete _allVehPlans[_recordVehicleId];
    closeM('m-record-maint');
    renderVehicles();
    if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === _recordVehicleId) dpVehicle(_recordVehicleId);
  })
  .catch(err => showToast(err.message || 'Failed to record maintenance', 't-error'));
}

/* ─────────────────────────────────────────────────────────
   PUT UNDER MAINTENANCE — checklist of plans
   ✅ FIX: now also calls PUT /api/vehicle/start-maint/:id so
   the vehicle's actual `status` column changes to
   UNDER_MAINTENANCE. Previously this only recorded plan
   history, so the vehicle never visually/logically entered
   maintenance mode and "Complete Maintenance" was dead code.
───────────────────────────────────────────────────────── */
let _checklistVehicleId = null;

async function openMaintenanceChecklist(vehicleId) {
  _checklistVehicleId = vehicleId;
  const plans = await fetchPlansForVehicle(vehicleId);

  const listEl = document.getElementById('maint-checklist-list');
  if (!plans.length) {
    listEl.innerHTML = `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">
      No maintenance plans set up for this vehicle yet. You can still put it under
      maintenance without selecting any items.</div>`;
  } else {
    listEl.innerHTML = plans.map(p => `
      <label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--slate-100);cursor:pointer">
        <input type="checkbox" class="maint-check" value="${p.maint_type_id}" data-basis="${p.basis}"
          style="width:14px;height:14px;accent-color:var(--blue-600)"/>
        <span style="font-weight:600;font-size:13px">${_escVeh(p.name)}</span>
        <span style="font-size:11px;color:var(--slate-400);text-transform:uppercase;margin-left:auto">${p.basis}</span>
      </label>`).join('');
  }

  document.getElementById('maint-checklist-odo').value = '';
  document.getElementById('maint-checklist-date').value = todayStr();
  document.getElementById('maint-checklist-remarks').value = '';
  openM('m-maint-checklist');
}

async function submitMaintenanceChecklist() {
  const checked = [...document.querySelectorAll('.maint-check:checked')];

  const odometer = document.getElementById('maint-checklist-odo').value || null;
  const date     = document.getElementById('maint-checklist-date').value;
  const remarks  = document.getElementById('maint-checklist-remarks').value;
  const needsOdo = checked.some(c => c.dataset.basis === 'odometer');
  if (needsOdo && !odometer) { showToast('Odometer reading is required for KM-based items', 't-error'); return; }

  try {
    // ✅ FIX: mark vehicle status as UNDER_MAINTENANCE first
    const statusRes = await fetch(`${API_URL}/api/vehicle/start-maint/${_checklistVehicleId}`, {
      method: 'PUT',
    });
    if (!statusRes.ok) throw new Error('Failed to update vehicle status');

    if (checked.length) {
      await Promise.all(checked.map(c =>
        fetch(`${API_URL}/api/vehicle-plans/perform/${c.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_id: _checklistVehicleId,
            odometer, remarks, performed_date: date,
            performed_by: currentUser?.name || null,
          }),
        })
      ));
    }

    showToast(
      checked.length
        ? `Vehicle under maintenance · ${checked.length} item(s) recorded ✅`
        : 'Vehicle put under maintenance ✅',
      't-success'
    );
    addLog('UPDATE', 'VEHICLE',
      `Put vehicle #${_checklistVehicleId} under maintenance${checked.length ? ` (${checked.length} item(s))` : ''}`,
      _checklistVehicleId);
    delete _allVehPlans[_checklistVehicleId];
    closeM('m-maint-checklist');
    renderVehicles();
    if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === _checklistVehicleId) dpVehicle(_checklistVehicleId);
  } catch {
    showToast('Failed to record maintenance', 't-error');
  }
}

function checkMonthlyOdoReminder() {
  const today = new Date();
  const day = today.getDate();
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat

  // ✅ first working day logic
  const isWorkingDay = dayOfWeek !== 0 && dayOfWeek !== 6;

  if (day <= 3 && isWorkingDay) {
    showToast("📊 Monthly Odometer Update Required", "t-warning");
  }
}

// ✅ FIX: removed redundant `window.renderVehicles = renderVehicles;`
// renderVehicles is already declared as a top-level function, which
// is automatically attached to `window` in a non-module script.