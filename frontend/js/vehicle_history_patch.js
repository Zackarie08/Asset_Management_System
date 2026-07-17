/* ============================================================
   vehicle_history_patch.js — Main History for Vehicles
   ============================================================
   Adds "View Item History" to the Vehicle DP (separate from the
   existing "Maintenance History" section, which stays as-is — that's
   the detailed per-service list; Item History is the vehicle
   record's own overall timeline: created/edited/status changes/
   deleted/maintenance events).

   Also wires user_id/performed_by into save/update calls that were
   previously sending none, so backend history attribution isn't null.

   Load AFTER vehicles_enhanced.js, vehicle_maintenance_patch.js, and
   item_history_panel.js.
   ============================================================ */

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
    vehicle_name, plate_number, type, purchase_date,
    status: 'ACTIVE', price, remarks, odometer,
    last_maintenance_km: 0, maintenance_threshold: 1000,
    user_id: currentUser.user_id,
    performed_by: currentUser.name,
  };

  const url    = vehEditId ? `${API_URL}/api/vehicle/${vehEditId}` : `${API_URL}/api/vehicle`;
  const method = vehEditId ? 'PUT' : 'POST';

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

function saveOdoUpdate() {
  const odometer = parseInt(document.getElementById('uo-km').value);

  if (!odometer && odometer !== 0) {
    showToast('Enter a valid odometer reading', 't-error');
    return;
  }

  fetch(`${API_URL}/api/vehicle/update-odo/${_odoVehicleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ odometer, user_id: currentUser.user_id, performed_by: currentUser.name }),
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

function completeMaintenance(id, currentKm, plate) {
  const odometer = prompt(`Complete maintenance for ${plate}.\n\nConfirm current odometer (km):`, currentKm);
  if (odometer === null) return;

  const parsedOdo = parseInt(odometer);
  if (isNaN(parsedOdo) || parsedOdo < 0) {
    showToast('Invalid odometer value', 't-error');
    return;
  }

  fetch(`${API_URL}/api/vehicle/complete-maint/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ odometer: parsedOdo, user_id: currentUser.user_id, performed_by: currentUser.name }),
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

async function submitMaintenanceChecklist() {
  const checked = [...document.querySelectorAll('.maint-check:checked')];

  const odometer = document.getElementById('maint-checklist-odo').value || null;
  const date     = document.getElementById('maint-checklist-date').value;
  const remarks  = document.getElementById('maint-checklist-remarks').value;
  const needsOdo = checked.some(c => c.dataset.basis === 'odometer');
  if (needsOdo && !odometer) { showToast('Odometer reading is required for KM-based items', 't-error'); return; }

  try {
    const statusRes = await fetch(`${API_URL}/api/vehicle/start-maint/${_checklistVehicleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.user_id, performed_by: currentUser.name }),
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
      `Put vehicle under maintenance${checked.length ? ` (${checked.length} item(s))` : ''}`,
      _checklistVehicleId);
    delete _allVehPlans[_checklistVehicleId];
    closeM('m-maint-checklist');
    renderVehicles();
    if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === _checklistVehicleId) dpVehicle(_checklistVehicleId);
  } catch {
    showToast('Failed to record maintenance', 't-error');
  }
}

/* ── DP: add View Item History ─────────────────────────────── */
async function dpVehicle(id) {
  const [vRes, maintRes] = await Promise.all([
    fetch(`${API_URL}/api/vehicle`).then(r => r.json()),
    fetch(`${API_URL}/api/vehicle/maintenance/${id}`).then(r => r.json()).catch(() => []),
  ]);

  const v = vRes.find(x => x.vehicle_id === id);
  if (!v) return;

  const plans   = await fetchPlansForVehicle(id);
  const km      = v.odometer || 0;

  setDPHeader('🚗', '#eff6ff', v.vehicle_name, `${v.type} · ${v.plate_number}`);

  const plansHTML = _buildPlansHTML(plans, km, id);

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
    <div class="dp-section">
      <div class="dp-section-hd">🚗 Vehicle Info</div>
      <div class="dp-grid">
        ${dpField('Plate Number', v.plate_number)}
        ${dpField('Type', v.type)}
        ${dpField('Status', v.status)}
        ${dpField('Odometer', km.toLocaleString() + ' km')}
        ${dpField('Last Maint. KM', (v.last_maintenance_km || 0).toLocaleString() + ' km')}
        ${dpField('Purchase Date', formatDateHuman(v.purchase_date))}
        ${dpField('Price', v.price ? '₱' + Number(v.price).toLocaleString() : '—')}
        ${v.remarks ? dpFieldFull('Remarks', v.remarks) : ''}
      </div>
    </div>

    <div class="dp-section" id="veh-plans-container-${id}">
      ${plansHTML}
    </div>

    <div class="dp-section">
      <div class="dp-section-hd" onclick="toggleVehMaintHistory(${id})">
        🔧 Maintenance History ${vehShowMaintHistory ? "▲" : "▼"}
      </div>
      ${vehShowMaintHistory ? maintHTML : ""}
    </div>

    <div class="dp-section" id="veh-att-${id}"></div>

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${isAdminUser() && v.status !== 'UNDER_MAINTENANCE' ? `
          <button class="btn btn-outline btn-sm" onclick="openUpdateOdo(${v.vehicle_id}, ${km}, '${_escVeh(v.plate_number)}')">📊 Update Odometer</button>
        ` : ''}
        ${isAdminUser() && v.status === 'UNDER_MAINTENANCE' ? `
          <button class="btn btn-green btn-sm" onclick="completeMaintenance(${v.vehicle_id}, ${km}, '${_escVeh(v.plate_number)}')">✅ Complete Maintenance</button>
        ` : ''}
        ${isAdminUser() ? `<button class="btn btn-outline btn-sm" onclick="editVehicle(${v.vehicle_id})">✏️ Edit</button>` : ''}
        ${itemHistoryButton('vehicle', v.vehicle_id, v.vehicle_name)}
        ${isAdminUser() ? `<button class="btn btn-red btn-sm" onclick="deleteVehicle(${v.vehicle_id}, '${_escVeh(v.plate_number)}')">🗑️ Delete</button>` : ''}
      </div>
    </div>
  `;

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';

  attachmentPanel('vehicles', id, `veh-att-${id}`);
}

/* ============================================================
   vehicle_plan_delete_patch.js
   ============================================================
   Fixes two problems with maintenance plan deletion:
     1. deletePlan() called the DELETE endpoint immediately on
        click, with only a native confirm() dialog (easy to
        misclick, inconsistent with every other delete flow in
        the app, which uses a proper modal).
     2. The resulting log said "Deleted maintenance plan #12" —
        no plan name, no vehicle context.

   Load AFTER vehicle_history_patch.js (or wherever deletePlan()
   currently lives last — same last-loaded-wins pattern).
   Requires the #m-confirm-plan-del modal markup added to
   index.html below this file.
   ============================================================ */

let _deletePlanId        = null;
let _deletePlanVehicleId = null;
let _deletePlanLabel     = '';
let _deletePlanVehLabel  = '';

function deletePlan(maintTypeId, vehicleId) {
  const plans = _allVehPlans[vehicleId] || [];
  const plan  = plans.find(p => p.maint_type_id === maintTypeId);
  const veh   = (_allVehicles || []).find(v => v.vehicle_id === vehicleId);

  _deletePlanId        = maintTypeId;
  _deletePlanVehicleId = vehicleId;
  _deletePlanLabel      = plan?.name || `Plan #${maintTypeId}`;
  _deletePlanVehLabel   = veh?.vehicle_name || `Vehicle #${vehicleId}`;

  const summaryEl = document.getElementById('plan-del-summary');
  if (summaryEl) {
    summaryEl.textContent = `${_deletePlanLabel} — ${_deletePlanVehLabel}`;
  }

  openM('m-confirm-plan-del');
}

async function confirmDeletePlan() {
  try {
    const res = await fetch(`${API_URL}/api/vehicle-plans/${_deletePlanId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');

    showToast('Plan deleted', 't-warning');

    // ✅ FIX: uses the captured plan name + vehicle name instead of raw ids
    addLog(
      'DELETE',
      'VEHICLE',
      `Deleted maintenance plan "${_deletePlanLabel}" from ${_deletePlanVehLabel}`,
      _deletePlanVehicleId
    );

    delete _allVehPlans[_deletePlanVehicleId];
    closeM('m-confirm-plan-del');
    renderVehicles();
    if (dpOpen && dpCurrentType === 'vehicle' && dpCurrentId === _deletePlanVehicleId) {
      dpVehicle(_deletePlanVehicleId);
    }
  } catch {
    showToast('Failed to delete plan', 't-error');
  }
}