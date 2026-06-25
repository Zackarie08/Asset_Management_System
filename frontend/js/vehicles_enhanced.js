/* ============================================================
   vehicles_enhanced.js
   Enhanced Vehicle Management with Maintenance Plans
   Augments existing main.js vehicle logic — does NOT replace it
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   MAINTENANCE PLANS — per vehicle
────────────────────────────────────────────────────────── */

let planEditId = null;
let planVehicleId = null;

async function loadMaintenancePlans(vehicleId) {
  try {
    const res   = await fetch(`${API_URL}/api/vehicle-plans/${vehicleId}`);
    const plans = await res.json();

    const vRes = await fetch(`${API_URL}/api/vehicle`);
    const vehicles = await vRes.json();
    const v = vehicles.find(x => x.vehicle_id === vehicleId);
    const currentKm = v ? (v.odometer || 0) : 0;

    return { plans, currentKm };
  } catch {
    return { plans: [], currentKm: 0 };
  }
}

function renderPlanBadge(plan, currentKm) {
  if (plan.basis === "odometer") {
    const remaining = plan.next_due_km - currentKm;
    if (remaining <= 0) return `<span class="badge b-red">Overdue (${Math.abs(remaining)} km over)</span>`;
    if (remaining <= 500) return `<span class="badge b-amber">Due soon (${remaining} km)</span>`;
    return `<span class="badge b-green">OK (${remaining} km left)</span>`;
  }
  const map = { overdue: "b-red", due_soon: "b-amber", ok: "b-green", pending: "b-slate", unknown: "b-slate" };
  const labels = { overdue: "Overdue", due_soon: "Due soon", ok: "OK", pending: "Not set", unknown: "—" };
  const s = plan.status_computed || "unknown";
  return `<span class="badge ${map[s] || "b-slate"}">${labels[s] || s}</span>`;
}

function planNextDueLabel(plan, currentKm) {
  if (plan.basis === "odometer") {
    return `Next: ${plan.next_due_km?.toLocaleString()} km`;
  }
  return plan.next_due_date ? `Next: ${plan.next_due_date}` : "Not yet performed";
}

async function renderPlansSection(vehicleId, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `<div style="color:var(--slate-400);font-size:12px;padding:8px">Loading plans…</div>`;

  const { plans, currentKm } = await loadMaintenancePlans(vehicleId);

  const adminButtons = isAdminUser() ? `
    <button class="btn btn-outline btn-sm" onclick="openAddPlan(${vehicleId})">+ Add Plan</button>` : "";

  if (!plans.length) {
    el.innerHTML = `
      <div class="dp-section-hd">🔧 Maintenance Plans</div>
      <div style="color:var(--slate-400);font-size:12px;padding:8px 0">No maintenance plans set up.</div>
      <div class="dp-action-row">${adminButtons}</div>`;
    return;
  }

  const planRows = plans.map(p => {
    const badge = renderPlanBadge(p, currentKm);
    const next  = planNextDueLabel(p, currentKm);
    const basisLabel = p.basis === "odometer"
      ? `Every ${Number(p.threshold_km).toLocaleString()} km`
      : `Every ${p.interval_value} ${p.interval_unit}(s)`;

    return `
      <div style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:13px;font-weight:700;color:var(--slate-800)">${_escVeh(p.name)}</span>
          ${badge}
        </div>
        <div style="display:flex;gap:16px;font-size:11.5px;color:var(--slate-500);margin-bottom:6px">
          <span>${basisLabel}</span>
          <span>${next}</span>
        </div>
        ${isAdminUser() ? `
        <div style="display:flex;gap:6px">
          <button class="btn btn-xs btn-outline" onclick="openRecordMaint(${vehicleId},'${_escVeh(p.name)}',${p.maint_type_id})">✅ Record</button>
          <button class="btn btn-xs btn-outline" onclick="openEditPlan(${p.maint_type_id},${vehicleId})">✏️</button>
          <button class="btn btn-xs btn-red" onclick="deletePlan(${p.maint_type_id},${vehicleId})">🗑️</button>
        </div>` : ""}
      </div>`;
  }).join("");

  el.innerHTML = `
    <div class="dp-section-hd" style="display:flex;justify-content:space-between;align-items:center">
      <span>🔧 Maintenance Plans</span>
      ${adminButtons}
    </div>
    ${planRows}`;
}

/* ── ADD / EDIT plan modal controls ─────────────────────── */

function openAddPlan(vehicleId) {
  planEditId    = null;
  planVehicleId = vehicleId;
  _resetPlanForm();
  _setBasisUI(document.getElementById("plan-f-basis").value);
  openM("m-plan-add");
}

async function openEditPlan(maint_type_id, vehicleId) {
  planEditId    = maint_type_id;
  planVehicleId = vehicleId;

  try {
    const res   = await fetch(`${API_URL}/api/vehicle-plans/${vehicleId}`);
    const plans = await res.json();
    const plan  = plans.find(p => p.maint_type_id === maint_type_id);
    if (!plan) return;

    document.getElementById("plan-f-name").value  = plan.name    || "";
    document.getElementById("plan-f-basis").value = plan.basis   || "odometer";
    _setBasisUI(plan.basis);

    if (plan.basis === "odometer") {
      document.getElementById("plan-f-km").value      = plan.threshold_km       || "";
      document.getElementById("plan-f-last-km").value = plan.last_maintenance_km || "";
    } else {
      document.getElementById("plan-f-interval").value = plan.interval_value    || "";
      document.getElementById("plan-f-unit").value     = plan.interval_unit     || "month";
      document.getElementById("plan-f-last-date").value= plan.last_performed_date
        ? new Date(plan.last_performed_date).toISOString().slice(0,10) : "";
    }

    openM("m-plan-add");
  } catch { showToast("Failed to load plan", "t-error"); }
}

function _setBasisUI(basis) {
  const odoSection  = document.getElementById("plan-odo-section");
  const timeSection = document.getElementById("plan-time-section");
  if (odoSection)  odoSection.style.display  = basis === "odometer" ? "block" : "none";
  if (timeSection) timeSection.style.display = basis === "time"     ? "block" : "none";
}

function _resetPlanForm() {
  ["plan-f-name","plan-f-km","plan-f-last-km","plan-f-interval","plan-f-last-date"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const basisEl = document.getElementById("plan-f-basis");
  if (basisEl) basisEl.value = "odometer";
  const unitEl = document.getElementById("plan-f-unit");
  if (unitEl) unitEl.value = "month";
}

function savePlan() {
  const name  = document.getElementById("plan-f-name").value.trim();
  const basis = document.getElementById("plan-f-basis").value;

  if (!name) { showToast("Plan name is required", "t-error"); return; }

  const payload = { vehicle_id: planVehicleId, name, basis };

  if (basis === "odometer") {
    const km     = parseInt(document.getElementById("plan-f-km").value);
    const lastKm = parseInt(document.getElementById("plan-f-last-km").value) || 0;
    if (!km || km <= 0) { showToast("Threshold KM is required", "t-error"); return; }
    payload.threshold_km        = km;
    payload.last_maintenance_km = lastKm;
  } else {
    const interval = parseInt(document.getElementById("plan-f-interval").value);
    const unit     = document.getElementById("plan-f-unit").value;
    const lastDate = document.getElementById("plan-f-last-date").value;
    if (!interval || interval <= 0) { showToast("Interval value is required", "t-error"); return; }
    payload.interval_value      = interval;
    payload.interval_unit       = unit;
    payload.last_performed_date = lastDate || null;
  }

  const url    = planEditId ? `${API_URL}/api/vehicle-plans/${planEditId}` : `${API_URL}/api/vehicle-plans`;
  const method = planEditId ? "PUT" : "POST";

  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); return r.json(); })
    .then(() => {
      showToast(planEditId ? "Plan updated" : "Plan added", "t-success");
      addLog(planEditId ? "UPDATE" : "CREATE", "VEHICLE", `${planEditId ? "Updated" : "Added"} maintenance plan: ${name}`, planVehicleId);
      planEditId = null;
      closeM("m-plan-add");
      renderPlansSection(planVehicleId, `veh-plans-${planVehicleId}`);
      // Refresh DP if open
      if (dpOpen && dpCurrentType === "vehicle" && dpCurrentId === planVehicleId) {
        dpVehicle(planVehicleId);
      }
    })
    .catch(err => showToast(err.message || "Failed to save plan", "t-error"));
}

async function deletePlan(maint_type_id, vehicleId) {
  if (!confirm("Delete this maintenance plan?")) return;
  try {
    const res = await fetch(`${API_URL}/api/vehicle-plans/${maint_type_id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    showToast("Plan deleted", "t-warning");
    addLog("DELETE", "VEHICLE", `Deleted maintenance plan #${maint_type_id}`, vehicleId);
    renderPlansSection(vehicleId, `veh-plans-${vehicleId}`);
  } catch { showToast("Failed to delete plan", "t-error"); }
}

/* ── Record maintenance against a plan ────────────────────── */

let _recordMaintTypeId = null;
let _recordVehicleId   = null;

function openRecordMaint(vehicleId, planName, maintTypeId) {
  _recordVehicleId   = vehicleId;
  _recordMaintTypeId = maintTypeId;

  document.getElementById("rec-maint-plan-name").textContent = planName;
  document.getElementById("rec-maint-date").value            = todayStr();
  document.getElementById("rec-maint-odo").value             = "";
  document.getElementById("rec-maint-cost").value            = "";
  document.getElementById("rec-maint-remarks").value         = "";

  openM("m-record-maint");
}

function saveRecordMaint() {
  const odometer = document.getElementById("rec-maint-odo").value;
  const cost     = document.getElementById("rec-maint-cost").value;
  const remarks  = document.getElementById("rec-maint-remarks").value;

  fetch(`${API_URL}/api/vehicle-plans/perform/${_recordMaintTypeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vehicle_id: _recordVehicleId,
      odometer: odometer || null,
      maintenance_cost: cost || null,
      remarks,
      performed_by: currentUser?.name || null,
    }),
  })
  .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error); }); return r.json(); })
  .then(() => {
    showToast("Maintenance recorded", "t-success");
    addLog("UPDATE", "VEHICLE", `Maintenance performed for plan #${_recordMaintTypeId}`, _recordVehicleId);
    closeM("m-record-maint");
    renderPlansSection(_recordVehicleId, `veh-plans-${_recordVehicleId}`);
    renderVehicles();
    if (dpOpen && dpCurrentType === "vehicle" && dpCurrentId === _recordVehicleId) {
      dpVehicle(_recordVehicleId);
    }
  })
  .catch(err => showToast(err.message || "Failed to record maintenance", "t-error"));
}

/* ── Override dpVehicle to include plans + attachment panel ── */
/* Patch applied after page load — augments the existing dpVehicle */

const _origDpVehicle = typeof dpVehicle === "function" ? dpVehicle : null;

async function dpVehicle(id) {
  // Call original logic first (renders base HTML)
  if (_origDpVehicle) await _origDpVehicle(id);

  // Inject plans section (will append after base HTML renders)
  // Find or create container inside dp-body
  setTimeout(async () => {
    const body = document.getElementById("dp-body");
    if (!body) return;

    // Plans section
    let planContainer = document.getElementById(`veh-plans-${id}`);
    if (!planContainer) {
      planContainer = document.createElement("div");
      planContainer.id = `veh-plans-${id}`;
      planContainer.className = "dp-section";
      body.appendChild(planContainer);
    }
    await renderPlansSection(id, `veh-plans-${id}`);

    // Attachment panel
    let attContainer = document.getElementById(`veh-att-${id}`);
    if (!attContainer) {
      attContainer = document.createElement("div");
      attContainer.id = `veh-att-${id}`;
      attContainer.className = "dp-section";
      body.appendChild(attContainer);
    }
    attachmentPanel("vehicles", id, `veh-att-${id}`);
  }, 50);
}

/* ──────────────────────────────────────────────────────────
   VEHICLE TABLE — enhanced with next-due column
────────────────────────────────────────────────────────── */

async function renderVehiclesEnhanced() {
  const [vRes, allPlansMap] = await Promise.all([
    fetch(`${API_URL}/api/vehicle`).then(r => r.json()).catch(() => []),
    // Fetch plans for all vehicles concurrently
    (async () => {
      const vehicles = await fetch(`${API_URL}/api/vehicle`).then(r => r.json()).catch(() => []);
      const map = {};
      await Promise.all(vehicles.map(async v => {
        const plans = await fetch(`${API_URL}/api/vehicle-plans/${v.vehicle_id}`).then(r => r.json()).catch(() => []);
        map[v.vehicle_id] = plans;
      }));
      return map;
    })(),
  ]);

  const tbody = document.getElementById("veh-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Stats
  const total    = vRes.length;
  const underM   = vRes.filter(v => v.status === "UNDER_MAINTENANCE").length;

  let dueSoonCount = 0;
  vRes.forEach(v => {
    const plans = allPlansMap[v.vehicle_id] || [];
    const km    = v.odometer || 0;
    plans.forEach(p => {
      if (p.basis === "odometer") {
        const remaining = (p.next_due_km || 0) - km;
        if (remaining <= 500) dueSoonCount++;
      } else {
        if (p.status_computed === "due_soon" || p.status_computed === "overdue") dueSoonCount++;
      }
    });
  });

  const ctEl = document.getElementById("veh-ct");
  if (ctEl) ctEl.textContent = `${total} vehicles`;

  // Optional stat elements (add IDs to HTML to use these)
  _setVehStat("veh-stat-total",  total);
  _setVehStat("veh-stat-maint",  underM);
  _setVehStat("veh-stat-due",    dueSoonCount);

  vRes.forEach(v => {
    const plans  = allPlansMap[v.vehicle_id] || [];
    const km     = v.odometer || 0;

    // Determine worst plan status
    let worstStatus = "ok";
    let nextLabel   = "—";

    plans.forEach(p => {
      if (p.basis === "odometer") {
        const remaining = (p.next_due_km || 0) - km;
        if (remaining <= 0 && worstStatus !== "overdue") worstStatus = "overdue";
        else if (remaining <= 500 && worstStatus === "ok") worstStatus = "due_soon";
        if (remaining <= 1000) nextLabel = `${p.name}: ${(p.next_due_km||0).toLocaleString()} km`;
      } else {
        const s = p.status_computed || "ok";
        if (s === "overdue" && worstStatus !== "overdue") worstStatus = "overdue";
        else if (s === "due_soon" && worstStatus === "ok") worstStatus = "due_soon";
        if (s !== "ok" && nextLabel === "—") nextLabel = `${p.name}: ${p.next_due_date || "soon"}`;
      }
    });

    const maintBadge =
      v.status === "UNDER_MAINTENANCE" ? `<span class="badge b-amber">🛠 Under Maint.</span>` :
      worstStatus === "overdue"         ? `<span class="badge b-red">⚠️ Overdue</span>` :
      worstStatus === "due_soon"        ? `<span class="badge b-amber">⚠️ Due Soon</span>` :
      plans.length > 0                  ? `<span class="badge b-green">On track</span>` :
      `<span class="badge b-slate">No plans</span>`;

    const tr = document.createElement("tr");
    tr.className = `tr-clickable${worstStatus === "overdue" ? " tr-warn" : ""}`;
    tr.innerHTML = `
      <td class="td-strong">${v.vehicle_name}</td>
      <td>${v.plate_number}</td>
      <td>${v.type}</td>
      <td>${(v.odometer || 0).toLocaleString()} km</td>
      <td style="font-size:11.5px;color:var(--slate-500)">${nextLabel}</td>
      <td>${maintBadge}</td>
    `;
    tr.addEventListener("click", () => openDP("vehicle", v.vehicle_id, tr));
    tbody.appendChild(tr);
  });
}

function _setVehStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _escVeh(str) {
  if (!str) return "—";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// Override renderVehicles with enhanced version
window.renderVehicles = renderVehiclesEnhanced;
