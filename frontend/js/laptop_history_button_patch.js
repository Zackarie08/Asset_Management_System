/* ============================================================
   laptop_history_button_patch.js — Main History button for Laptops
   ============================================================
   Laptop backend history hooks were already added in the
   immutability fix pass (backend/routes/laptops.js). This adds the
   "View Item History" button to the DP — it was missed at that time.

   Assignment History (the laptop_history table shown lower in this
   DP) stays a SEPARATE section, as confirmed correct — it's a
   detailed, laptop-specific record of who-had-it-when, while Item
   History is the general cross-module timeline (created/edited/
   assigned/unassigned/deleted, etc.) also shown for every other item.

   Load AFTER laptop_dashboard_patches.js and item_history_panel.js.
   ============================================================ */

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

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${isAdminUser() ? `
          <button class="btn btn-green btn-sm" onclick="openAssign(${lp.laptop_id})">👤 Assign User</button>
          ${lp.current_user_id ? `<button class="btn btn-amber btn-sm" onclick="removeAssignedUser(${lp.laptop_id})">↩️ Remove Current User</button>` : ''}
          <button class="btn btn-primary btn-sm" onclick="openMaint(${lp.laptop_id})">🔧 Technical Check</button>
          <button class="btn btn-outline btn-sm" onclick="editLaptop(${lp.laptop_id})">✏️ Edit</button>
        ` : ''}
        ${itemHistoryButton('laptop', lp.laptop_id, `${lp.asset_number} · ${lp.serial_number}`)}
        ${isAdminUser() ? `<button class="btn btn-red btn-sm" onclick="deleteLaptop(${lp.laptop_id})">🗑️ Delete</button>` : ''}
      </div>
    </div>

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

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.laptop = dpLaptop;

/* ============================================================
   laptop_delete_label_patch.js
   ============================================================
   Fixes two problems in the laptop delete flow:
     1. System Log said "Deleted laptop" with no identifying info.
     2. confirmDeleteLaptop() passed currentUser.name as the log's
        reference_type param — that field is meant to identify the
        RECORD being acted on (the laptop), not who performed the
        action (system_log already has a separate user_id/
        performed_by column for that).

   Uses cachedLp (already populated by dpLaptop when the detail
   panel is open) for the label — no extra fetch needed.

   Load AFTER laptop_history_button_patch.js.
   ============================================================ */

let deleteLaptopId    = null;
let deleteLaptopLabel = '';

function deleteLaptop(id) {
  deleteLaptopId = id;
  deleteLaptopLabel = (cachedLp && cachedLp.laptop_id === id)
    ? `${cachedLp.asset_number} (SN: ${cachedLp.serial_number})`
    : `Laptop #${id}`;
  const labelEl = document.getElementById('lp-del-label');
  if (labelEl) labelEl.textContent = deleteLaptopLabel;
  openM("m-confirm-lp-del");
}

function confirmDeleteLaptop() {
  fetch(`${API_URL}/api/laptops/${deleteLaptopId}`, {
    method: "DELETE"
  })
  .then(() => {
    showToast("Laptop Deleted", "t-warning");

    // ✅ FIX: reference_type is now the laptop's own id (matches every
    // other module's delete pattern), and the description carries the
    // asset/serial identity instead of currentUser.name.
    addLog("DELETE", "LAPTOP", `Deleted laptop: ${deleteLaptopLabel}`, deleteLaptopId);

    closeM("m-confirm-lp-del");
    closeDP();
    renderLaptops();
  })
  .catch(() => showToast("Error deleting laptop", "t-error"));
}
