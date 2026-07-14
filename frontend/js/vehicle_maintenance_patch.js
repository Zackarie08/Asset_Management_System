/* ============================================================
   vehicle_maintenance_patch.js — Part 4
   ============================================================
   Simplifies time-based maintenance plans to Monthly / Yearly only
   (removes Weekly + the free-form "Every N" quantity input), matching
   the backend validation in vehicleMaintPlans.js.

   Load AFTER vehicles_enhanced.js.
   Requires the index.html patch in Vehicle_Maintenance_Rework.md
   (removes the "Every *" number input, changes Unit -> Frequency
   with only Month(s)/Year(s) options).
   ============================================================ */

function _setBasisUI(basis) {
  const odoSection  = document.getElementById('plan-odo-section');
  const timeSection = document.getElementById('plan-time-section');
  if (odoSection)  odoSection.style.display  = basis === 'odometer' ? 'block' : 'none';
  if (timeSection) timeSection.style.display = basis === 'time'     ? 'block' : 'none';
}

function _resetPlanForm() {
  ['plan-f-name','plan-f-km','plan-f-last-km','plan-f-last-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const basisEl = document.getElementById('plan-f-basis');
  if (basisEl) basisEl.value = 'odometer';
  // ✅ FIX: no more interval-count field — only a Monthly/Yearly choice
  const unitEl = document.getElementById('plan-f-unit');
  if (unitEl) unitEl.value = 'month';
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
      // ✅ FIX: no interval-count input to populate anymore
      document.getElementById('plan-f-unit').value      = plan.interval_unit === 'year' ? 'year' : 'month';
      document.getElementById('plan-f-last-date').value = plan.last_performed_date
        ? new Date(plan.last_performed_date).toISOString().slice(0,10) : '';
    }
    openM('m-plan-add');
  } catch { showToast('Failed to load plan', 't-error'); }
}

function savePlan() {
  const name  = document.getElementById('plan-f-name').value.trim();
  const basis = document.getElementById('plan-f-basis').value;
  if (!name) { showToast('Plan name is required', 't-error'); return; }

  const payload = {
    vehicle_id: planVehicleId, name, basis,
    user_id: currentUser.user_id,
    performed_by: currentUser.name,
  };

  if (basis === 'odometer') {
    const km     = parseInt(document.getElementById('plan-f-km').value);
    const lastKm = parseInt(document.getElementById('plan-f-last-km').value) || 0;
    if (!km || km <= 0) { showToast('Threshold KM is required', 't-error'); return; }
    payload.threshold_km        = km;
    payload.last_maintenance_km = lastKm;
  } else {
    // ✅ FIX: Monthly/Yearly only — no interval count sent
    const unit     = document.getElementById('plan-f-unit').value;
    const lastDate = document.getElementById('plan-f-last-date').value;
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
      delete _allVehPlans[planVehicleId];
      planEditId = null;
      closeM('m-plan-add');
      renderVehicles();
      if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === planVehicleId) dpVehicle(planVehicleId);
    })
    .catch(err => showToast(err.message || 'Failed to save plan', 't-error'));
}

/* ── Plan card: cleaner "Every month" / "Every year" label ─────── */
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

    // ✅ FIX: clean "Every month" / "Every year" (no "Every 1 month(s)")
    const intervalLabel = plan.interval_unit === 'year' ? 'Every year' : 'Every month';

    visualHTML = `
      <div style="margin:8px 0;font-size:12px;color:var(--slate-600)">
        <div style="margin-bottom:3px">${dueLabel}</div>
        <div style="color:var(--slate-400)">${intervalLabel} · Last performed: ${
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
