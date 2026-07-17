
/* ──────────────────────────────────────────────────────────────
   LAPTOPS
────────────────────────────────────────────────────────────── */

let showMaintHistory = true;
let showAssignHistory = false;
let cachedLp = null;
let cachedHistory = [];
let cachedMaintenance = [];

// ── Filter/pagination state ──
let lpSearchQuery    = '';
let lpFilterStatus   = 'all';
let lpFilterLocation = 'all';
let lpFilterWarranty = 'all';
let lpFilterAssigned = 'all'; 
let currentLpPage    = 1;
const lpPerPage      = 20;
let _allLaptops      = [];
let _lpRenderToken   = 0; 


function _lpWarrantyCategory(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const w = new Date(dateStr);
  const daysLeft = Math.ceil((w - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)   return 'expired';
  if (daysLeft <= 30) return 'expiring';
  return 'active';
}

function _lpMaintenanceStatus(maintRecords) {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const isMaintMonth = (month === 6 || month === 12);
  if (!isMaintMonth) return null;

  const hasCheck = maintRecords.some(m => {
    const d = new Date(m.check_date);
    return d.getMonth() + 1 === month && d.getFullYear() === now.getFullYear();
  });
  return hasCheck ? 'checked' : 'due';
}

function _lpMaintenanceBadge(status) {
  if (status === 'due')     return `<span class="badge b-amber">⚠️ Check Due</span>`;
  if (status === 'checked') return `<span class="badge b-green">✅ Checked</span>`;
  return '—';
}

function applyLpFilters() {
  lpFilterStatus   = document.getElementById('lp-filter-status').value;
  lpFilterLocation = document.getElementById('lp-filter-location').value;
  lpFilterWarranty = document.getElementById('lp-filter-warranty').value;
  lpFilterAssigned = document.getElementById('lp-filter-assigned').value;
  currentLpPage    = 1;
  _renderLpTable();
}

function _filterLaptops(data) {
  return data.filter(lp => {

    // Search — asset no., description, serial, assigned user name
    if (lpSearchQuery) {
      const haystack = `${lp.asset_number} ${lp.item_description} ${lp.serial_number || ''} ${lp.user_name || ''}`.toLowerCase();
      if (!haystack.includes(lpSearchQuery)) return false;
    }

    // Status filter
    if (lpFilterStatus !== 'all' && lp.status !== lpFilterStatus) return false;

    // Location filter (by location_id)
    if (lpFilterLocation !== 'all' && String(lp.current_location) !== String(lpFilterLocation)) return false;

    // Warranty filter
    if (lpFilterWarranty !== 'all') {
      if (!lp.warranty_end_date) return false;
      if (_lpWarrantyCategory(lp.warranty_end_date) !== lpFilterWarranty) return false;
    }

    if (lpFilterAssigned === 'assigned' && !lp.current_user_id) return false;
    if (lpFilterAssigned === 'unassigned' && lp.current_user_id) return false;

    return true;
  });
}

function _renderLpPagination(total) {
  const container = document.getElementById('lp-pagination-container');
  if (!container) return;

  const totalPages = Math.ceil(total / lpPerPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentLpPage === 1;
  prev.onclick = () => { currentLpPage--; _renderLpTable(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentLpPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => { currentLpPage = i; _renderLpTable(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentLpPage === totalPages;
  next.onclick = () => { currentLpPage++; _renderLpTable(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

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

async function _loadLpLocationsFilter() {
  try {
    const res    = await fetch(`${API_URL}/api/location`);
    const data   = await res.json();
    const select = document.getElementById('lp-filter-location');
    if (!select) return;
    const prev = select.value;
    select.innerHTML = '<option value="all">Location: All</option>';
    data.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.location_id;
      opt.textContent = loc.location_name;
      select.appendChild(opt);
    });
    if ([...select.options].some(o => o.value === prev)) select.value = prev;
  } catch (err) {
    console.error('Failed to load laptop location filter', err);
  }
}

async function renderLaptops() {
  try {
    const res    = await fetch(`${API_URL}/api/laptops`);
    _allLaptops  = await res.json();
    await _loadLpLocationsFilter();
    currentLpPage = 1;
    await _renderLpTable();
  } catch (err) {
    console.error('renderLaptops error:', err);
    showToast('Failed to load laptops', 't-error');
  }
}

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
function toggleMaintHistory() {
  showMaintHistory = !showMaintHistory;
  dpLaptop(cachedLp.laptop_id, true); 
}

function toggleAssignHistory() {
  showAssignHistory = !showAssignHistory;
  dpLaptop(cachedLp.laptop_id, true);
}

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

let editLaptopId = null;

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

function formatDateForInput(dateStr) {
  if (!dateStr) return "";

  const d = new Date(dateStr);
  return d.toISOString().split('T')[0]; // ✅ YYYY-MM-DD
}

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

let currentLpId = null;

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

function openMaint(id) {
  currentLpId = id;

  document.getElementById('maint-name').textContent = "Laptop ID: " + id;
  document.getElementById('maint-sn').textContent = "-";
  document.getElementById('maint-date').value = todayStr();
  document.getElementById('maint-cond').value = 'GOOD';
  document.getElementById('maint-remarks').value = '';

  openM('m-maint');
}

function saveMaintenance() {
  const cond = document.getElementById('maint-cond').value;
  const date = document.getElementById('maint-date').value;
  const remarks = document.getElementById('maint-remarks').value;

  fetch(`${API_URL}/api/laptop-maintenance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      laptop_id: currentLpId,
      check_date: date,
      condition: cond,
      remarks,
      user_id: currentUser.user_id
    })
  })
  .then(() => {
    showToast("Technical Check saved", "t-success");

    // ✅ FIXED LOG
    addLog(
      "UPDATE",
      "LAPTOP",
      `Technical check: ${cond} (${remarks || "no remarks"}) | Laptop: ${cachedLp?.asset_number || currentLpId}`,
      currentLpId
    );

    closeM('m-maint');
    renderLaptops();
    
    if (dpOpen && dpCurrentType === "laptop") {
      dpLaptop(dpCurrentId); 
    }

  });
}

   
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
    addLog("DELETE", "LAPTOP", `Deleted laptop: ${deleteLaptopLabel}`, deleteLaptopId);

    closeM("m-confirm-lp-del");
    closeDP();
    renderLaptops();
  })
  .catch(() => showToast("Error deleting laptop", "t-error"));
}


async function loadLocationsDropdown() {
  const res = await fetch(`${API_URL}/api/location`);
  const data = await res.json();

  const select = document.getElementById("lp-f-location");
  select.innerHTML = '<option value="">Select Location</option>';

  data.forEach(loc => {
    select.innerHTML += `<option value="${loc.location_id}">${loc.location_name}</option>`;
  });
}

function openAddLaptop() {
  editLaptopId = null;
  const title = document.querySelector('#m-add-lp .modal-title');
  if (title) title.textContent = "💻 Add Laptop";
  openM("m-add-lp");
  loadLocationsDropdown();
}

let userMap = {};

async function loadAssignUsers() {
  const res = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();

  const names = users.map(u => u.name);

  makeSearchable("assign-user", "assign-user-list", names);

  userMap = {};
  users.forEach(u => {
    userMap[u.name] = u.user_id;
  });
}

function getMaintenanceAlert() {
  const today = new Date();
  const month = today.getMonth() + 1; // 1–12

  if (month === 6 || month === 12) {
    return "⚠️ Scheduled Maintenance Month (June/December)";
  }

  return null;
}

function _escVeh_lp(str) {
  if (!str) return '—';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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


if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.laptop = dpLaptop;
