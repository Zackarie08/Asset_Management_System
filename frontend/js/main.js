/* ──────────────────────────────────────────────────────────────
   SESSION / AUTH
────────────────────────────────────────────────────────────── */
let currentUser = null; // { name, role, initials }
let _currentContract = null;
let currentPage = 'dashboard';

function isAdminUser() {
  return currentUser.role === "admin" || currentUser.role === "super_admin";
}

// ============================================================
// main_constants.js — Navigation config & DP router
// Paste these CONSTANTS into the top of main.js, replacing
// existing ADMIN_NAV, EMP_NAV, PAGE_META definitions.
//
// CHANGES:
//  - Removed globe, m365, master-subscriptions from nav
//  - Single "subscriptions" entry covers all three
//  - insurance dpType added to openDP renderer map
//  - editState declared properly (was accidental global)
// ============================================================

/* ── NAV ITEMS ──────────────────────────────────────────── */
const ADMIN_NAV = [
  { id: "dashboard",     icon: "🏠", label: "Dashboard"           },
  { id: "inventory",     icon: "📦", label: "Inventory Management", badge: "inv" },
  { id: "orders",        icon: "🛒", label: "Purchase Orders",     badge: "po"  },
  { id: "furniture",     icon: "🪑", label: "Office Furniture"     },
  { id: "itsupplies",    icon: "🖨️", label: "IT Supplies",         badge: "it"  },
  { id: "laptops",       icon: "💻", label: "Laptops"              },
  { id: "vehicles",      icon: "🚗", label: "Vehicle Management"   },
  { id: "contracts",     icon: "📄", label: "Contracts"            },
  // ✅ CHANGE: globe, m365, subscriptions, master-subscriptions
  //           replaced with ONE unified subscriptions entry
  { id: "subscriptions", icon: "🔐", label: "Subscriptions",       admin: true  },
  { id: "insurance",     icon: "🛡️", label: "Insurance",           admin: true  },
  { id: "finance",       icon: "📁", label: "Finance Documents",   admin: true  },
  { id: "logs",          icon: "📜", label: "System Logs",         admin: true  },
  { id: "users",         icon: "👤", label: "Users",               admin: true  },
];

// Pages accessible to non-admin roles
const EMP_NAV = [
  "dashboard","inventory","orders","furniture",
  "itsupplies","laptops","vehicles","contracts"
];

/* ── PAGE METADATA (breadcrumb) ─────────────────────────── */
const PAGE_META = {
  dashboard:     { title: "Dashboard",            parent: "Asset Management System" },
  inventory:     { title: "Inventory Management", parent: "Asset Management System" },
  orders:        { title: "Purchase Orders",      parent: "Asset Management System" },
  furniture:     { title: "Office Furniture",     parent: "Asset Management System" },
  itsupplies:    { title: "IT Supplies",          parent: "Asset Management System" },
  laptops:       { title: "Laptop Management",    parent: "Asset Management System" },
  vehicles:      { title: "Vehicle Management",   parent: "Asset Management System" },
  contracts:     { title: "Contracts",            parent: "Asset Management System" },
  subscriptions: { title: "Subscriptions",        parent: "Asset Management System" },
  insurance:     { title: "Insurance",            parent: "Asset Management System" },
  finance:       { title: "Finance Documents",    parent: "Asset Management System" },
  logs:          { title: "System Logs",          parent: "Asset Management System" },
  users:         { title: "Users",                parent: "Asset Management System" },
};

/* ── EDIT STATE (was accidental global) ─────────────────── */
// ✅ FIX: declare with let so it doesn't pollute the global scope implicitly
let editState = { id: null, type: null };
let dpOpen = false;
let dpSelectedRow = null;
let dpCurrentType = null;
let dpCurrentId   = null;

/* ── DP RENDERER MAP ────────────────────────────────────── */
// Used inside openDP() — maps type strings to handler functions.
// Note: globe/m365/subscriptions remain so that clicking unified
// table rows still opens the correct type-specific detail panel.
const DP_RENDERERS = {
  inventory:     dpInventory,
  furniture:     dpFurniture,
  order:         dpOrder,
  itsupplies:    dpITSupplies,
  laptop:        dpLaptop,
  vehicle:       dpVehicle,
  contracts:     dpContract,
  subscriptions: dpSubscriptions,
  globe:         dpGlobe,
  m365:          dpM365,
  insurance:     dpInsurance,   // ✅ NEW
  finance:       dpFinance,
  log:           dpLog,
  user:          dpUser,
};

// Replace the openDP function in main.js with this cleaner version:
function openDP(type, id, row) {
  if (dpSelectedRow) dpSelectedRow.classList.remove("selected");
  dpSelectedRow = row;
  dpCurrentType = type;
  dpCurrentId   = id;
  if (row) row.classList.add("selected");

  document.getElementById("detail-panel").classList.add("open");
  document.getElementById("app-body").classList.add("panel-open");
  dpOpen = true;

  const renderer = DP_RENDERERS[type];
  if (renderer) {
    renderer(id);
  } else {
    console.warn(`No DP renderer registered for type: "${type}"`);
  }
}



function closeDP() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('app-body').classList.remove('panel-open');
  if (dpSelectedRow) { dpSelectedRow.classList.remove('selected'); dpSelectedRow = null; }
  dpOpen = false; dpCurrentType = null; dpCurrentId = null;
}

function setDPHeader(icon, iconBg, title, sub) {
  const el = document.getElementById('dp-icon');
  el.textContent = icon; el.style.background = iconBg;
  document.getElementById('dp-title').textContent    = title;
  document.getElementById('dp-subtitle').textContent = sub;
}










/* ──────────────────────────────────────────────────────────────
   OFFICE FURNITURE
────────────────────────────────────────────────────────────── */

let furEditId        = null;
let furSearchQuery   = '';
let furFilterLocation = 'all';
let furFilterCondition = 'all';
let furFilterDate    = 'all';
let furDateFrom      = '';
let furDateTo        = '';
let currentFurPage   = 1;
const furPerPage     = 20;
let _allFurniture    = [];

function applyFurFilters() {
  furFilterLocation  = document.getElementById('fur-filter-location').value;
  furFilterCondition = document.getElementById('fur-filter-condition').value;
  furFilterDate      = document.getElementById('fur-filter-date').value;
  furDateFrom        = document.getElementById('fur-date-from')?.value || '';
  furDateTo          = document.getElementById('fur-date-to')?.value   || '';
  currentFurPage     = 1;

  const customRange = document.getElementById('fur-custom-range');
  if (customRange) {
    customRange.style.display = furFilterDate === 'custom' ? 'flex' : 'none';
  }

  _renderFurTable();
}

function _filterFurniture(data) {
  const now      = new Date();
  const thisYear = now.getFullYear();

  return data.filter(f => {

    // Search — name or supplier
    if (furSearchQuery) {
      const haystack = `${f.furniture_name} ${f.supplier || ''}`.toLowerCase();
      if (!haystack.includes(furSearchQuery)) return false;
    }

    // Location filter
    if (furFilterLocation !== 'all' && f.location_name !== furFilterLocation) return false;

    // Condition filter
    if (furFilterCondition !== 'all' && f.condition !== furFilterCondition) return false;

    // Date filter
    if (furFilterDate !== 'all' && f.date_of_purchase) {
      const d = new Date(f.date_of_purchase);

      if (furFilterDate === 'this_year') {
        if (d.getFullYear() !== thisYear) return false;

      } else if (furFilterDate === 'last_year') {
        if (d.getFullYear() !== thisYear - 1) return false;

      } else if (furFilterDate === 'custom') {
        if (furDateFrom && d < new Date(furDateFrom)) return false;
        if (furDateTo) {
          const to = new Date(furDateTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
      }
    }

    return true;
  });
}

function _renderFurPagination(total) {
  const container = document.getElementById('fur-pagination-container');
  if (!container) return;

  const totalPages = Math.ceil(total / furPerPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentFurPage === 1;
  prev.onclick = () => { currentFurPage--; _renderFurTable(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentFurPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => { currentFurPage = i; _renderFurTable(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentFurPage === totalPages;
  next.onclick = () => { currentFurPage++; _renderFurTable(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

function _renderFurTable() {
  const filtered  = _filterFurniture(_allFurniture);
  const total     = filtered.length;
  const start     = (currentFurPage - 1) * furPerPage;
  const paginated = filtered.slice(start, start + furPerPage);

  const tbody = document.getElementById('fur-tbody');
  tbody.innerHTML = '';

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--slate-400)">No furniture found.</td></tr>`;
  } else {
    paginated.forEach(f => {
      const condCls = {
        New:        'b-blue',
        Good:       'b-green',
        Fair:       'b-amber',
        'For Repair': 'b-red'
      }[f.condition] || 'b-slate';

      const tr = document.createElement('tr');
      tr.className = 'tr-clickable';
      tr.innerHTML = `
        <td class="td-strong">${f.furniture_name}</td>
        <td>${f.quantity}</td>
        <td class="td-mono">${f.date_of_purchase ? new Date(f.date_of_purchase).toLocaleDateString('en-PH', {year:'numeric',month:'short',day:'numeric'}) : '—'}</td>
        <td>${f.price ? '₱' + Number(f.price).toLocaleString() : '—'}</td>
        <td>${f.location_name || '—'}</td>
        <td>${f.condition ? `<span class="badge ${condCls}">${f.condition}</span>` : '—'}</td>
      `;
      tr.addEventListener('click', () => openDP('furniture', f.office_furniture_id, tr));
      tbody.appendChild(tr);
    });
  }

  document.getElementById('fur-ct').textContent = `${total} items`;
  _renderFurPagination(total);
}

async function _loadFurLocationsFilter() {
  try {
    const res  = await fetch(`${API_URL}/api/location`);
    const data = await res.json();
    const select = document.getElementById('fur-filter-location');
    if (!select) return;
    const prev = select.value;
    select.innerHTML = '<option value="all">Location: All</option>';
    data.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.location_name;
      opt.textContent = loc.location_name;
      select.appendChild(opt);
    });
    if ([...select.options].some(o => o.value === prev)) select.value = prev;
  } catch (err) {
    console.error('Failed to load location filter', err);
  }
}

async function renderFurniture() {
  try {
    const res   = await fetch(`${API_URL}/api/furniture`);
    _allFurniture = await res.json();
    await _loadFurLocationsFilter();
    currentFurPage = 1;
    _renderFurTable();
  } catch (err) {
    console.error('renderFurniture error:', err);
    showToast('Failed to load furniture', 't-error');
  }
}

async function dpFurniture(id) {
  const f = _allFurniture.find(x => x.office_furniture_id === id);
  if (!f) return;

  const condCls = {
    New:        'b-blue',
    Good:       'b-green',
    Fair:       'b-amber',
    'For Repair': 'b-red'
  }[f.condition] || 'b-slate';

  setDPHeader('🪑', '#fffbeb', f.furniture_name, 'Office Furniture');

  document.getElementById('dp-body').innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">📦 Asset Information</div>
      <div class="dp-grid">
        ${dpFieldFull('Asset Name', `<strong>${f.furniture_name}</strong>`)}
        ${dpField('Quantity', f.quantity)}
        ${dpField('Date Purchased', f.date_of_purchase ? new Date(f.date_of_purchase).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—')}
        ${dpField('Price / Unit', f.price ? '₱' + Number(f.price).toLocaleString() : '—')}
        ${dpField('Total Value', f.price && f.quantity ? '₱' + (Number(f.price) * f.quantity).toLocaleString() : '—')}
        ${dpField('Location', f.location_name || '—')}
        ${dpField('Condition', f.condition ? `<span class="badge ${condCls}">${f.condition}</span>` : '—')}
      </div>
    </div>

    ${f.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', f.remarks)}</div></div>` : ''}

    ${isAdminUser() ? `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm" onclick="editFur(${f.office_furniture_id})">✏️ Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteFur(${f.office_furniture_id}, '${f.furniture_name.replace(/'/g,"\\'")}')">🗑️ Delete</button>
      </div>
    </div>` : ''}
  `;

  document.getElementById('dp-footer').style.display = 'none';
}

function saveFurniture() {
  const name    = document.getElementById('fur-f-name').value.trim();
  const qty     = document.getElementById('fur-f-qty').value;
  const date    = document.getElementById('fur-f-date').value;
  const price   = document.getElementById('fur-f-price').value;
  const loc     = document.getElementById('fur-f-loc').value;
  const remarks = document.getElementById('fur-f-remarks').value;

  if (!name || !qty || !loc) {
    showToast('Fill required fields', 't-error');
    return;
  }

  const url    = furEditId ? `${API_URL}/api/furniture/${furEditId}` : `${API_URL}/api/furniture`;
  const method = furEditId ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      furniture_name:   name,
      quantity:         qty,
      date_of_purchase: date,
      price,
      remarks,
      current_location: loc
    })
  })
  .then(res => { if (!res.ok) throw new Error('Failed'); })
  .then(() => {
    showToast(furEditId ? 'Furniture updated' : 'Furniture added', 't-success');
    addLog(furEditId ? 'UPDATE' : 'CREATE', 'FURNITURE',
      `${furEditId ? 'Updated' : 'Added'} furniture: ${name}`, name);
    furEditId = null;
    closeM('m-add-fur');
    renderFurniture();
    if (dpOpen && dpCurrentType === 'furniture') dpFurniture(dpCurrentId);
  })
  .catch(() => showToast('Error saving furniture', 't-error'));
}

async function editFur(id) {
  const f = _allFurniture.find(x => x.office_furniture_id === id);
  if (!f) return;

  furEditId = id;
  openM('m-add-fur');
  await loadFurLocations();

  document.getElementById('fur-f-name').value    = f.furniture_name;
  document.getElementById('fur-f-qty').value     = f.quantity;
  document.getElementById('fur-f-date').value    = f.date_of_purchase ? new Date(f.date_of_purchase).toISOString().slice(0,10) : '';
  document.getElementById('fur-f-price').value   = f.price || '';
  document.getElementById('fur-f-loc').value     = f.current_location;
  document.getElementById('fur-f-remarks').value = f.remarks || '';
}

let deleteFurId   = null;
let deleteFurName = '';

function deleteFur(id, name) {
  deleteFurId   = id;
  deleteFurName = name;
  openM('m-confirm-fur-del');
}

function confirmDeleteFur() {
  fetch(`${API_URL}/api/furniture/${deleteFurId}`, { method: 'DELETE' })
  .then(res => { if (!res.ok) throw new Error('Failed'); })
  .then(() => {
    showToast('Furniture deleted', 't-warning');
    addLog('DELETE', 'FURNITURE', `Deleted furniture: ${deleteFurName}`, deleteFurName);
    closeM('m-confirm-fur-del');
    closeDP();
    renderFurniture();
  })
  .catch(() => showToast('Error deleting furniture', 't-error'));
}

async function loadFurLocations() {
  const res  = await fetch(`${API_URL}/api/location`);
  const data = await res.json();
  const select = document.getElementById('fur-f-loc');
  select.innerHTML = '';
  data.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc.location_id;
    opt.textContent = loc.location_name;
    select.appendChild(opt);
  });
}

function openAddFurniture() {
  furEditId = null;
  openM('m-add-fur');
  loadFurLocations();
}



















/* ──────────────────────────────────────────────────────────────
   IT SUPPLIES
────────────────────────────────────────────────────────────── */

let itEditId          = null;
let itSearchQuery     = '';
let itFilterLocation  = 'all';
let itFilterStatus    = 'all';
let itFilterWarranty  = 'all';
let currentITPage     = 1;
const itPerPage       = 20;
let _allITSupplies    = [];

function applyITFilters() {
  itFilterLocation = document.getElementById('it-filter-location').value;
  itFilterStatus   = document.getElementById('it-filter-status').value;
  itFilterWarranty = document.getElementById('it-filter-warranty').value;
  currentITPage    = 1;
  _renderITTable();
}

function _filterIT(data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return data.filter(it => {

    // Search — name, serial, supplier
    if (itSearchQuery) {
      const haystack = `${it.asset_name} ${it.serial_number || ''} ${it.supplier || ''}`.toLowerCase();
      if (!haystack.includes(itSearchQuery)) return false;
    }

    // Location filter
    if (itFilterLocation !== 'all' && it.location_name !== itFilterLocation) return false;

    // Status filter
    if (itFilterStatus !== 'all' && it.status !== itFilterStatus) return false;

    // Warranty filter
    if (itFilterWarranty !== 'all' && it.warranty_end_date) {
      const w = new Date(it.warranty_end_date);
      const daysLeft = Math.ceil((w - today) / (1000 * 60 * 60 * 24));

      if (itFilterWarranty === 'active'   && daysLeft <= 30) return false;
      if (itFilterWarranty === 'expiring' && (daysLeft > 30 || daysLeft < 0)) return false;
      if (itFilterWarranty === 'expired'  && daysLeft >= 0) return false;
    }

    return true;
  });
}

function _renderITPagination(total) {
  const container = document.getElementById('it-pagination-container');
  if (!container) return;

  const totalPages = Math.ceil(total / itPerPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentITPage === 1;
  prev.onclick = () => { currentITPage--; _renderITTable(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentITPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => { currentITPage = i; _renderITTable(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentITPage === totalPages;
  next.onclick = () => { currentITPage++; _renderITTable(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

function _warrantyBadge(warrantyDate) {
  if (!warrantyDate) return '<span class="badge b-slate">No Warranty</span>';
  const today    = new Date(); today.setHours(0,0,0,0);
  const w        = new Date(warrantyDate);
  const daysLeft = Math.ceil((w - today) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0)   return `<span class="badge b-red">Expired</span>`;
  if (daysLeft <= 30) return `<span class="badge b-amber">Expiring in ${daysLeft}d</span>`;
  return `<span class="badge b-green">Active</span>`;
}

function _renderITTable() {
  const filtered  = _filterIT(_allITSupplies);
  const total     = filtered.length;
  const start     = (currentITPage - 1) * itPerPage;
  const paginated = filtered.slice(start, start + itPerPage);

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

      const tr = document.createElement('tr');
      tr.className = 'tr-clickable';
      tr.innerHTML = `
        <td class="td-strong">${it.asset_name}</td>
        <td class="td-mono">${it.serial_number || '—'}</td>
        <td>${it.quantity}</td>
        <td>${_warrantyBadge(it.warranty_end_date)}</td>
        <td>${it.location_name || '—'}</td>
        <td>${it.status ? `<span class="badge ${statusCls}">${it.status}</span>` : '—'}</td>
      `;
      tr.addEventListener('click', () => openDP('itsupplies', it.it_supplies_id, tr));
      tbody.appendChild(tr);
    });
  }

  document.getElementById('it-total-ct').textContent = `${total} items`;
  _renderITPagination(total);
}

async function _loadITLocationsFilter() {
  try {
    const res    = await fetch(`${API_URL}/api/location`);
    const data   = await res.json();
    const select = document.getElementById('it-filter-location');
    if (!select) return;
    const prev = select.value;
    select.innerHTML = '<option value="all">Location: All</option>';
    data.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.location_name;
      opt.textContent = loc.location_name;
      select.appendChild(opt);
    });
    if ([...select.options].some(o => o.value === prev)) select.value = prev;
  } catch (err) {
    console.error('Failed to load IT location filter', err);
  }
}

async function renderITSupplies() {
  try {
    const res      = await fetch(`${API_URL}/api/it-supplies`);
    _allITSupplies = await res.json();
    await _loadITLocationsFilter();
    currentITPage  = 1;
    _renderITTable();
  } catch (err) {
    console.error('renderITSupplies error:', err);
    showToast('Failed to load IT supplies', 't-error');
  }
}

async function dpITSupplies(id) {
  const it = _allITSupplies.find(x => x.it_supplies_id === id);
  if (!it) return;

  const statusCls = {
    Available: 'b-green',
    'In Use':  'b-blue',
    Damaged:   'b-red'
  }[it.status] || 'b-slate';

  setDPHeader('🖨️', '#eef2ff', it.asset_name, 'IT Supply');

  document.getElementById('dp-body').innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">💻 Asset Details</div>
      <div class="dp-grid">
        ${dpFieldFull('Asset Name', `<strong>${it.asset_name}</strong>`)}
        ${dpField('Serial / Model', it.serial_number || '—', 'mono')}
        ${dpField('Quantity', it.quantity)}
        ${dpField('Date Purchased', it.date_of_purchase ? new Date(it.date_of_purchase).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—')}
        ${dpField('Price', it.price ? '₱' + Number(it.price).toLocaleString() : '—')}
        ${dpField('Location', it.location_name || '—')}
        ${dpField('Status', it.status ? `<span class="badge ${statusCls}">${it.status}</span>` : '—')}
        ${dpField('Warranty', _warrantyBadge(it.warranty_end_date))}
        ${dpField('Warranty Expiry', it.warranty_end_date ? new Date(it.warranty_end_date).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—', 'mono')}
      </div>
    </div>

    ${it.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', it.remarks)}</div></div>` : ''}

    ${isAdminUser() ? `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm" onclick="editIT(${it.it_supplies_id})">✏️ Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteIT(${it.it_supplies_id}, '${it.asset_name.replace(/'/g,"\\'")}')">🗑️ Delete</button>
      </div>
    </div>` : ''}
  `;

  document.getElementById('dp-footer').style.display = 'none';
}

let deleteITId   = null;
let deleteITName = '';

function saveITSupply() {
  const name     = document.getElementById('it-f-name').value.trim();
  const serial   = document.getElementById('it-f-serial').value.trim();
  const qty      = document.getElementById('it-f-qty').value;
  const date     = document.getElementById('it-f-date').value;
  const price    = document.getElementById('it-f-price').value;
  const warranty = document.getElementById('it-f-warranty').value;
  const loc      = document.getElementById('it-f-loc').value;
  const status   = document.getElementById('it-f-status').value;
  const remarks  = document.getElementById('it-f-remarks').value;

  if (!name || !qty || !loc) {
    showToast('Fill required fields', 't-error');
    return;
  }

  const url    = itEditId ? `${API_URL}/api/it-supplies/${itEditId}` : `${API_URL}/api/it-supplies`;
  const method = itEditId ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset_name:       name,
      serial_number:    serial,
      quantity:         qty,
      date_of_purchase: date,
      price,
      warranty_end_date: warranty,
      location_id:      loc,
      status,
      remarks
    })
  })
  .then(res => { if (!res.ok) throw new Error('Failed'); })
  .then(() => {
    showToast(itEditId ? 'IT Supply updated' : 'IT Supply added', 't-success');
    addLog(itEditId ? 'UPDATE' : 'CREATE', 'IT SUPPLY',
      `${itEditId ? 'Updated' : 'Added'} IT supply: ${name}`, name);
    itEditId = null;
    closeM('m-add-it');
    renderITSupplies();
    if (dpOpen && dpCurrentType === 'itsupplies') dpITSupplies(dpCurrentId);
  })
  .catch(() => showToast('Error saving IT supply', 't-error'));
}

async function editIT(id) {
  const it = _allITSupplies.find(x => x.it_supplies_id === id);
  if (!it) return;

  itEditId = id;
  openM('m-add-it');
  await loadITLocations();

  document.getElementById('it-f-name').value     = it.asset_name;
  document.getElementById('it-f-serial').value   = it.serial_number || '';
  document.getElementById('it-f-qty').value      = it.quantity;
  document.getElementById('it-f-date').value     = it.date_of_purchase ? new Date(it.date_of_purchase).toISOString().slice(0,10) : '';
  document.getElementById('it-f-price').value    = it.price || '';
  document.getElementById('it-f-warranty').value = it.warranty_end_date ? new Date(it.warranty_end_date).toISOString().slice(0,10) : '';
  document.getElementById('it-f-loc').value      = it.location_id;
  document.getElementById('it-f-status').value   = it.status || 'Available';
  document.getElementById('it-f-remarks').value  = it.remarks || '';
}

function deleteIT(id, name) {
  deleteITId   = id;
  deleteITName = name;
  openM('m-confirm-it-del');
}

function confirmDeleteIT() {
  fetch(`${API_URL}/api/it-supplies/${deleteITId}`, { method: 'DELETE' })
  .then(res => { if (!res.ok) throw new Error('Failed'); })
  .then(() => {
    showToast('IT Supply deleted', 't-warning');
    addLog('DELETE', 'IT SUPPLY', `Deleted IT supply: ${deleteITName}`, deleteITName);
    closeM('m-confirm-it-del');
    closeDP();
    renderITSupplies();
  })
  .catch(() => showToast('Error deleting IT supply', 't-error'));
}

async function loadITLocations() {
  const res    = await fetch(`${API_URL}/api/location`);
  const data   = await res.json();
  const select = document.getElementById('it-f-loc');
  select.innerHTML = '';
  data.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc.location_id;
    opt.textContent = loc.location_name;
    select.appendChild(opt);
  });
}

function openAddIT() {
  itEditId = null;
  openM('m-add-it');
  loadITLocations();
}















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
  currentLpPage    = 1;
  _renderLpTable();
}

function _filterLaptops(data) {
  return data.filter(lp => {

    // Search — asset no., description, serial
    if (lpSearchQuery) {
      const haystack = `${lp.asset_number} ${lp.item_description} ${lp.serial_number || ''}`.toLowerCase();
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
  const myToken = ++_lpRenderToken;   // ✅ mark this call as the latest

  const filtered  = _filterLaptops(_allLaptops);
  const total     = filtered.length;
  const start     = (currentLpPage - 1) * lpPerPage;
  const paginated = filtered.slice(start, start + lpPerPage);

  if (paginated.length === 0) {
    if (myToken !== _lpRenderToken) return; // a newer render started — abort this one
    const tbody = document.getElementById('lp-tbody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--slate-400)">No laptops found.</td></tr>`;
    document.getElementById('lp-ct').textContent = `${total} units`;
    _renderLpPagination(total);
    return;
  }

  // Fetch maintenance records only for the rows actually being shown (page size, not full list)
  const maintResults = await Promise.all(
    paginated.map(lp =>
      fetch(`${API_URL}/api/laptop-maintenance/${lp.laptop_id}`)
        .then(r => r.json())
        .catch(() => [])
    )
  );

  // ✅ If another _renderLpTable() call started while we were waiting on the
  // maintenance fetches above, this call is stale — drop it instead of
  // appending on top of whatever the newer call already wrote.
  if (myToken !== _lpRenderToken) return;

  const tbody = document.getElementById('lp-tbody');
  tbody.innerHTML = '';   // ✅ clear right before writing, not before the await

  paginated.forEach((lp, i) => {
    const sCls = {
      Active: 'b-green',
      'For Repair': 'b-red',
      Disposed: 'b-slate'
    }[lp.status] || 'b-slate';

    const maintStatus = _lpMaintenanceStatus(maintResults[i]);

    const tr = document.createElement('tr');
    tr.className = 'tr-clickable';

    tr.innerHTML = `
      <td>${lp.asset_number}</td>
      <td>${lp.serial_number}</td>
      <td>${lp.current_user_id || '—'}</td>
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

  const alertMsg = getMaintenanceAlert();

  let data, history, maintenance;

  // ✅ ONLY FETCH IF NOT USING CACHE
  if (!useCache || !cachedLp) {
    const res = await fetch(`${API_URL}/api/laptops`);
    data = await res.json();

    const histRes = await fetch(`${API_URL}/api/laptops/${id}/history`);
    history = await histRes.json();

    const maintRes = await fetch(`${API_URL}/api/laptop-maintenance/${id}`);
    maintenance = await maintRes.json();

    const lp = data.find(x => x.laptop_id === id);
    if (!lp) return;

    // ✅ SAVE CACHE
    cachedLp = lp;
    cachedHistory = history;
    cachedMaintenance = maintenance;

  } else {
    // ✅ USE CACHE
    data = [cachedLp];
    history = cachedHistory;
    maintenance = cachedMaintenance;
  }

  const lp = cachedLp;

  //--------------------------------
  // DEVICE LOGIC

  const purchaseDate = new Date(lp.date_of_purchase);
  const ageYears = Math.floor((new Date() - purchaseDate) / (365.25*24*3600*1000));

  const isIntern = lp.user_role === "intern";
  const needsReplace = ageYears >= 3 && !isIntern;

  setDPHeader('💻', '#f0fdf4', lp.asset_number, lp.serial_number);

  //--------------------------------
  // MAINT ALERT

  const now = new Date();
  const month = now.getMonth() + 1;

  const isMaintenanceMonth = (month === 6 || month === 12);

  const hasCheckThisMonth = maintenance.some(m => {
    const d = new Date(m.check_date);
    return d.getMonth() + 1 === month &&
           d.getFullYear() === now.getFullYear();
  });

  const showMaintenanceAlert = isMaintenanceMonth && !hasCheckThisMonth;

  //--------------------------------
  // HISTORY HTML

  let histHTML = history.length
    ? `
      <ul class="mh-list">
        ${history.map(h => `
          <li class="mh-item">
            <div class="mh-dot good"></div>
            <div>
              <div class="mh-cond info">
                ${h.previous_user_name || '—'} → ${h.new_user_name || '—'}
              </div>
              <div class="mh-date">
                ${new Date(h.date_changed).toLocaleDateString('en-US', {
                  year:'numeric', month:'short', day:'numeric'
                })}
              </div>
              <div class="mh-remarks">
                ${h.remarks || 'User assignment update'}
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    `
    : `
      <div style="text-align:center;padding:16px;color:var(--slate-400);font-size:12px">
        No assignment history yet.
      </div>
    `;

  let maintHTML = maintenance.length
    ? `
      <ul class="mh-list">
        ${maintenance.map(m => `
          <li class="mh-item">
            <div class="mh-dot good"></div>
            <div>
              <div class="mh-cond info">${m.condition}</div>
              <div class="mh-date">
                ${new Date(m.check_date).toLocaleDateString()}
              </div>
              <div class="mh-remarks">
                ${m.remarks || "No remarks"}
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    `
    : `
      <div style="text-align:center;padding:16px;color:var(--slate-400);font-size:12px">
        No technical check records yet.
      </div>
    `;

  //--------------------------------
  // FINAL UI (UNCHANGED STRUCTURE ✅)

  const html = `
    <div class="dp-section">
      ${showMaintenanceAlert ? `
        <div class="dp-alert warning">
          ⚠️ Technical Check required this month (June/December)
        </div>
      ` : ""}

      ${needsReplace ? `
        <div class="dp-alert danger">
          ⚠️ Laptop is ${ageYears} years old — needs replacement
        </div>
      ` : ""}
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">💻 Device Info</div>
      <div class="dp-grid">
        ${dpField("Asset Number", lp.asset_number)}
        ${dpField("Serial Number", lp.serial_number || '-')}

        ${dpField("Brand", lp.category)}
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
          <button class="btn btn-primary btn-sm" onclick="openMaint(${lp.laptop_id})">🔧 Technical Check</button>
          <button class="btn btn-outline btn-sm" onclick="editLaptop(${lp.laptop_id})">✏️ Edit</button>
          <button class="btn btn-red btn-sm" onclick="deleteLaptop(${lp.laptop_id})">🗑️ Delete</button>
        </div>
      </div>
    ` : ""}

    <div class="dp-section">
      <div class="dp-section-hd" onclick="toggleAssignHistory()">
        📜 Assignment History ${showAssignHistory ? "▲" : "▼"}
      </div>
      ${showAssignHistory ? histHTML : ""}
    </div>

    <div class="dp-section">
      <div class="dp-section-hd" onclick="toggleMaintHistory()">
        🔧 Technical Check History ${showMaintHistory ? "▲" : "▼"}
      </div>
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
  const asset = document.getElementById('lp-f-asset').value.trim();
  const desc = document.getElementById('lp-f-desc').value.trim();
  const serial = document.getElementById('lp-f-serial').value.trim();
  const brand = document.getElementById('lp-f-brand').value;
  const location = document.getElementById('lp-f-location').value;
  const status = document.getElementById('lp-f-status').value;
  const warranty = document.getElementById('lp-f-warranty').value;
  const bought = document.getElementById('lp-f-bought').value;
  const price = document.getElementById('lp-f-price').value;

  // ✅ validation
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
    date_of_purchase: bought
  };

  // ✅ THIS WAS MISSING 🔥
  const url = editLaptopId
    ? `${API_URL}/api/laptops/${editLaptopId}`
    : `${API_URL}/api/laptops`;

  const method = editLaptopId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(() => {
    const isEdit = !!editLaptopId;

    showToast(isEdit ? "Laptop updated" : "Laptop added", "t-success");

    addLog(
      isEdit ? "UPDATE" : "CREATE",
      "LAPTOP",
      isEdit 
        ? "Updated laptop: " + asset
        : "Added laptop: " + asset,
      editLaptopId || asset
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

  openAddLaptop(); // opens modal + loads dropdown

  // ✅ WAIT a bit for dropdown to load
  setTimeout(() => {
    document.getElementById('lp-f-asset').value = lp.asset_number;
    document.getElementById('lp-f-desc').value = lp.item_description;
    document.getElementById('lp-f-serial').value = lp.serial_number;
    document.getElementById('lp-f-brand').value = lp.category;
    document.getElementById('lp-f-location').value = lp.current_location;
    document.getElementById('lp-f-status').value = lp.status;
    document.getElementById('lp-f-warranty').value = formatDateForInput(lp.warranty_end_date);
    document.getElementById('lp-f-bought').value = formatDateForInput(lp.date_of_purchase);
    document.getElementById('lp-f-price').value = lp.price || "";
  }, 100); // ✅ small delay
  renderLaptops();
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";

  const d = new Date(dateStr);
  return d.toISOString().split('T')[0]; // ✅ YYYY-MM-DD
}

async function openAssign(id) {
  currentLpId = id;

  document.getElementById('assign-lp-name').textContent = "Laptop ID: " + id;
  document.getElementById('assign-user').value = '';

  openM('m-assign');
}

let currentLpId = null;

function doAssign() {
  const userName = document.getElementById("assign-user").value;
  const user_id  = userMap[userName];

  if (!user_id) {
    showToast("Select a valid user", "t-error");
    return;
  }

  // ✅ FIX: use /assign/:id (not /:id which now handles full edit)
  fetch(`${API_URL}/api/laptops/assign/${currentLpId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_user_id: user_id })
  })
  .then(res => {
    if (!res.ok) throw new Error("Assign failed");
    showToast("Laptop assigned", "t-success");
    addLog("UPDATE", "LAPTOP", `Assigned laptop to ${userName}`, currentLpId);
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

let deleteLaptopId = null;

function deleteLaptop(id) {
  deleteLaptopId = id;
  openM("m-confirm-lp-del");
}

function confirmDeleteLaptop() {
  fetch(`${API_URL}/api/laptops/${deleteLaptopId}`, {
    method: "DELETE"
  })
  .then(() => {
    showToast("Laptop Deleted", "t-warning");

    addLog("DELETE", "LAPTOP", "Deleted laptop", currentUser.name);

    closeM("m-confirm-lp-del");
    closeDP();
    renderLaptops();
  });
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

async function openAssign(id) {
  currentLpId = id;

  document.getElementById('assign-user').value = "";

  openM('m-assign');
  await loadAssignUsers();
}

function getMaintenanceAlert() {
  const today = new Date();
  const month = today.getMonth() + 1; // 1–12

  if (month === 6 || month === 12) {
    return "⚠️ Scheduled Maintenance Month (June/December)";
  }

  return null;
}






















/* ──────────────────────────────────────────────────────────────
   CONTRACTS
────────────────────────────────────────────────────────────── */

let deleteContractId = null;

// ── Filter/pagination state ──
let conSearchQuery    = '';
let conFilterValidity = 'all';
let conFilterExpiry   = 'all';
let conFilterStatus   = 'all';
let conFilterDate     = 'all';
let conDateFrom       = '';
let conDateTo         = '';
let currentConPage    = 1;
const conPerPage      = 20;
let _allContracts     = [];

// ── Shared expiry computation (used by table + filters) ──
function _computeContractExpiry(c) {
  if (c.validity_type === 'NA') {
    return { badge: `<span class="badge b-slate">N/A</span>`, status: 'na' };
  }
  const expiryDate = c.validity_type === "YEAR"
    ? new Date(`${c.valid_year}-12-31`)
    : c.valid_to ? new Date(c.valid_to) : null;

  if (!expiryDate) return { badge: '—', status: 'na' };

  const days = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0)   return { badge: `<span class="badge b-red">Expired</span>`, status: 'expired' };
  if (days <= 30) return { badge: `<span class="badge b-amber">Expires in ${days}d</span>`, status: 'expiring' };
  return { badge: `<span class="badge b-green">Valid</span>`, status: 'valid' };
}
// ✅ NEW: single source of truth for the contract status badge.
// Shows the actual current holder ("With <Name>") instead of the raw
// WITH_EMPLOYEE status string. Used by both the table and the detail panel
// so they can never drift out of sync again.
function _contractStatusLabel(c) {
  if (c.status === 'IN_STORAGE') {
    return `<span class="badge b-green">In Storage</span>`;
  }
  if (c.status === 'WITH_EMPLOYEE') {
    const holder = c.current_holder_name ? `With ${_esc(c.current_holder_name)}` : 'With Employee';
    return `<span class="badge b-blue">${holder}</span>`;
  }
  return `<span class="badge b-slate">${c.status || '—'}</span>`;
}

async function renderContracts() {
  try {
    const res     = await fetch(`${API_URL}/api/contracts`);
    _allContracts = await res.json();
    currentConPage = 1;
    _renderConTable();
  } catch (err) {
    console.error("renderContracts error:", err);
    showToast("Failed to load contracts", "t-error");
  }
}

function applyConFilters() {
  conFilterValidity = document.getElementById('con-filter-validity').value;
  conFilterExpiry   = document.getElementById('con-filter-expiry').value;
  conFilterStatus   = document.getElementById('con-filter-status').value;
  conFilterDate     = document.getElementById('con-filter-date').value;
  conDateFrom       = document.getElementById('con-date-from')?.value || '';
  conDateTo         = document.getElementById('con-date-to')?.value   || '';
  currentConPage    = 1;

  const customRange = document.getElementById('con-custom-range');
  if (customRange) {
    customRange.style.display = conFilterDate === 'custom' ? 'flex' : 'none';
  }

  _renderConTable();
}

function _filterContracts(data) {
  const now      = new Date();
  const thisYear = now.getFullYear();

  return data.filter(c => {

    // Search — other party or description
    if (conSearchQuery) {
      const haystack = `${c.other_party} ${c.description}`.toLowerCase();
      if (!haystack.includes(conSearchQuery)) return false;
    }

    // Validity type filter
    if (conFilterValidity !== 'all' && c.validity_type !== conFilterValidity) return false;

    // Expiry status filter
    if (conFilterExpiry !== 'all') {
      const { status } = _computeContractExpiry(c);
      if (status !== conFilterExpiry) return false;
    }

    // Status filter
    if (conFilterStatus !== 'all' && c.status !== conFilterStatus) return false;

    // Date filter (on contract_date)
    if (conFilterDate !== 'all' && c.contract_date) {
      const d = new Date(c.contract_date);

      if (conFilterDate === 'this_year') {
        if (d.getFullYear() !== thisYear) return false;

      } else if (conFilterDate === 'last_year') {
        if (d.getFullYear() !== thisYear - 1) return false;

      } else if (conFilterDate === 'custom') {
        if (conDateFrom && d < new Date(conDateFrom)) return false;
        if (conDateTo) {
          const to = new Date(conDateTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
      }
    }

    return true;
  });
}

function _renderConTable() {
  const filtered  = _filterContracts(_allContracts);
  const total     = filtered.length;
  const start     = (currentConPage - 1) * conPerPage;
  const paginated = filtered.slice(start, start + conPerPage);

  const tbody = document.getElementById("con-tbody");
  tbody.innerHTML = "";

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--slate-400)">No contracts found.</td></tr>`;
  } else {
    paginated.forEach(c => {
      let validity = '—';
      if (c.validity_type === 'NA') {
        validity = '<span class="badge b-slate">No Expiration</span>';
      } else if (c.validity_type === 'YEAR') {
        validity = c.valid_year || '—';
      } else {
        validity = `${c.valid_from || '—'} — ${c.valid_to || '—'}`;
      }

      const { badge: expiryBadge } = _computeContractExpiry(c);

      const tr = document.createElement("tr");
      tr.className = "tr-clickable";
      tr.innerHTML = `
        <td>${c.contract_date}</td>
        <td>${c.other_party}</td>
        <td>${c.description}</td>
        <td>${validity}</td>
        <td>${expiryBadge}</td>
      `;
      tr.onclick = () => openDP("contracts", c.contract_id, tr);
      tbody.appendChild(tr);
    });
  }

  document.getElementById("con-ct").textContent = total + " records";
  _renderConPagination(total);
}

function _renderConPagination(total) {
  const container = document.getElementById('con-pagination-container');
  if (!container) return;

  const totalPages = Math.ceil(total / conPerPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentConPage === 1;
  prev.onclick = () => { currentConPage--; _renderConTable(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentConPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => { currentConPage = i; _renderConTable(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentConPage === totalPages;
  next.onclick = () => { currentConPage++; _renderConTable(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}


async function dpContract(id) {
  const res = await fetch(`${API_URL}/api/contracts/${id}`);
  const c   = await res.json();
  if (!c) return;

  _currentContract = c;

  setDPHeader("📄", "#eef2ff", c.other_party, c.description);

  let validity = '—';
  if (c.validity_type === 'NA') {
    validity = 'No Expiration (NA)';
  } else if (c.validity_type === 'YEAR') {
    validity = c.valid_year || '—';
  } else {
    validity = `${c.valid_from || '—'} — ${c.valid_to || '—'}`;
  }

  // ✅ NA: skip expiry badge
  let expiryBadge = "";
  if (c.validity_type === 'NA') {
    expiryBadge = `<span class="badge b-slate">No Expiration</span>`;
  } else {
    const expiryDate = c.validity_type === "YEAR"
      ? new Date(`${c.valid_year}-12-31`)
      : c.valid_to ? new Date(c.valid_to) : null;

    if (expiryDate) {
      const days = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      if (days < 0)       expiryBadge = `<span class="badge b-red">Expired</span>`;
      else if (days <= 30) expiryBadge = `<span class="badge b-amber">Expires in ${days}d</span>`;
      else                 expiryBadge = `<span class="badge b-green">Valid</span>`;
    }
  }

  const statusBadge = _contractStatusLabel(c);

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">📋 Details</div>
      <div class="dp-grid">
        ${dpField("Date",          c.contract_date)}
        ${dpField("Other Party",   c.other_party)}
        ${dpField("Description",   c.description)}
        ${dpField("Validity Type", c.validity_type)}
        ${dpField("Validity",      validity)}
        ${dpField("Status",        statusBadge)}
        ${dpField("Expiry Status", expiryBadge)}
      </div>
    </div>

    ${c.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', c.remarks)}</div></div>` : ''}
    <div id="contract-actions"></div>`;

  document.getElementById("dp-body").innerHTML = html;
  renderContractActions(c);
}

async function saveContract() {
  const type = document.getElementById("con-f-type").value;

  const payload = {
    contract_date: document.getElementById("con-f-date").value,
    other_party:   document.getElementById("con-f-party").value,
    description:   document.getElementById("con-f-desc").value,
    validity_type: type,
    // ✅ For NA: don't send date fields
    valid_year: type === "YEAR"  ? document.getElementById("con-f-year").value : null,
    valid_from: type === "RANGE" ? document.getElementById("con-f-from").value : null,
    valid_to:   type === "RANGE" ? document.getElementById("con-f-to").value   : null,
    remarks:    document.getElementById("con-f-remarks").value
  };

  const url    = window.editContractId ? `${API_URL}/api/contracts/${window.editContractId}` : `${API_URL}/api/contracts`;
  const method = window.editContractId ? "PUT" : "POST";

  await fetch(url, {
    method,
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });

  showToast("Contract Saved", "t-success");
  addLog(
    window.editContractId ? "UPDATE" : "CREATE",
    "CONTRACT",
    `${window.editContractId ? "Updated" : "Added"} Contract | ${payload.other_party}`,
    window.editContractId || null
  );

  window.editContractId = null;
  closeM("m-add-con");
  renderContracts();
}

async function renderContractActions(c) {

  const el = document.getElementById("contract-actions");
  if (!el) return;

  const isAdmin =
    currentUser.role === "admin" ||
    currentUser.role === "super_admin";

  // ✅ NEW (Change 3): only super_admin may approve/deny. isAdmin still
  // covers view/return/edit/delete — see below.
  const isSuperAdmin = currentUser.role === "super_admin";

  let buttons = "";
  let info = "";

  try {
    const res = await fetch(`${API_URL}/api/contracts/requests`);
    const requests = await res.json();

    // ✅ DEFINE THIS FIRST
    const latestReq = requests
      .filter(r => r.contract_id == c.contract_id)
      .sort((a, b) => new Date(b.request_date) - new Date(a.request_date))[0];

    // ✅ ACTIVE REQUEST ONLY
    const currentReq = requests.find(r =>
      r.contract_id == c.contract_id &&
      (r.status === "PENDING" || r.status === "APPROVED")
    );

    if (latestReq) {

      let statusColor = "good";

      if (latestReq.status === "APPROVED") statusColor = "good";
      if (latestReq.status === "PENDING") statusColor = "warn";
      if (latestReq.status === "REJECTED") statusColor = "bad";

      info = `
        <ul class="mh-list">
          <li class="mh-item">
            <div class="mh-dot ${statusColor}"></div>
            <div>
              <div class="mh-cond info">
                ${latestReq.requested_name}
              </div>

              <div class="mh-date">
                ${new Date(latestReq.request_date).toLocaleDateString('en-US', {
                  year:'numeric', month:'short', day:'numeric'
                })}
              </div>

              <div class="mh-remarks">
                Status: ${latestReq.status}
              </div>
            </div>
          </li>
        </ul>
      `;
    }

    // ✅ EMPLOYEE

    if (!isAdmin) {

      // ✅ NO ACTIVE REQUEST → allow
      if (!currentReq) {
        buttons = `
          <button class="btn btn-primary btn-sm"
            onclick="requestContract(${c.contract_id})">
            📩 Request Contract
          </button>
        `;
      }

      // ✅ ANOTHER USER REQUESTED → BLOCK
      else if (currentReq.requested_by !== currentUser.user_id) {
        buttons = `
          <button class="btn btn-outline btn-sm" disabled>
            🔒 Requested by ${currentReq.requested_name}
          </button>
        `;
      }

      // ✅ FIX (Change 4): only offer Cancel while still PENDING. An
      // APPROVED request belonging to this user can no longer be
      // cancelled (the backend already refused it silently — now the
      // button doesn't even appear).
      else if (currentReq.status === "PENDING") {
        buttons = `
          <button class="btn btn-red btn-sm"
            onclick="cancelRequest(${currentReq.request_id})">
            ❌ Cancel Request
          </button>
        `;
      } else if (currentReq.status === "APPROVED") {
        buttons = `
          <span class="td-muted" style="font-size:12px">
            ✅ You currently hold this contract
          </span>
        `;
      }
    }

    // ADMIN / SUPER ADMIN
    if (isAdmin) {

      // ✅ FIX (Change 3): Approve/Deny gated to super_admin only.
      // Regular admins see an explanatory note instead of dead buttons —
      // the real enforcement lives server-side in contracts.js.
      if (currentReq && currentReq.status === "PENDING") {
        if (isSuperAdmin) {
          buttons = `
            <button class="btn btn-green btn-sm"
              onclick="approveRequest(${currentReq.request_id})">
              Approve
            </button>

            <button class="btn btn-red btn-sm"
              onclick="denyRequest(${currentReq.request_id})">
              Deny
            </button>
          `;
        } else {
          buttons = `
            <span class="td-muted" style="font-size:12px">
              ⏳ Pending — only a Super Admin can approve/deny
            </span>
          `;
        }
      }

      if (c.status === "WITH_EMPLOYEE" && currentReq) {
        buttons += `
          <button class="btn btn-outline btn-sm"
            onclick="returnContract(${currentReq.request_id})">
            Mark as Returned
          </button>
        `;
      }
    }
    if (isAdmin) {
      buttons += `
        <button class="btn btn-primary btn-sm"
          onclick="editContract(${c.contract_id})">
          ✏️ Edit
        </button>

        <button class="btn btn-red btn-sm"
          onclick="deleteContract(${c.contract_id})">
          🗑️ Delete
        </button>
      `;
    }

  } catch (err) {
    console.error(err);
    buttons = "<span class='dp-muted'>Error loading actions</span>";
  }

  el.innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>

      <div class="dp-action-row" style="margin-bottom:10px;">
        ${buttons || "<span class='dp-muted'>No actions available</span>"}
      </div>

      <div class="dp-history">
        ${info}
      </div>
    </div>
  `;
}

function editContract(id) {
  fetch(`${API_URL}/api/contracts/${id}`)
    .then(res => res.json())
    .then(c => {
      openM("m-add-con");
      setTimeout(() => {
        document.getElementById("con-f-date").value  = c.contract_date   || "";
        document.getElementById("con-f-party").value = c.other_party     || "";
        document.getElementById("con-f-desc").value  = c.description     || "";
        document.getElementById("con-f-type").value  = c.validity_type   || "YEAR";
        toggleValidity();

        document.getElementById("con-f-year").value  = c.valid_year || "";
        document.getElementById("con-f-from").value  = c.valid_from || "";
        document.getElementById("con-f-to").value    = c.valid_to   || "";
        document.getElementById("con-f-remarks").value = c.remarks  || "";

        window.editContractId = id;
      }, 100);
    });
}

function deleteContract(id) {
  deleteContractId = id;
  openM("m-confirm-con-del");
}

function confirmDeleteContract() {

  fetch(`${API_URL}/api/contracts/${deleteContractId}`)
    .then(res => res.json())
    .then(c => {

      return fetch(`${API_URL}/api/contracts/${deleteContractId}`, {
        method: "DELETE"
      }).then(() => c);
    })
    .then(c => {

      addLog(
        "DELETE",
        "CONTRACT",
        `Deleted Contract | ${c.other_party}`,
        deleteContractId
      );

      showToast("Contract Deleted", "t-warning");

      closeM("m-confirm-con-del");
      closeDP();
      renderContracts();
    });
}
function requestContract(id) {
  fetch(`${API_URL}/api/contracts/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contract_id: id, user_id: currentUser.user_id })
  })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    showToast("Contract request sent", "t-success");
    addLog("REQUEST", "CONTRACT",
      `Requested contract | ${_currentContract?.other_party || id}`, id);
    refreshContractUI(id); // ✅ FIX: unified refresh (table + open DP)
  })
  .catch(err => showToast(err.message || "Request failed", "t-error"));
}

function approveRequest(id) {
  fetch(`${API_URL}/api/contracts/request/${id}/approve`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_id: currentUser.user_id })
  })
  .then(res => {
    // ✅ FIX: was ignoring failed responses entirely — a 403 (non-super-admin)
    // or 400 (already processed) previously still showed "Contract approved".
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    showToast("Contract approved", "t-success");
    addLog("REQUEST", "CONTRACT",
      `Approved request | ${_currentContract?.other_party || id}`, id);
    refreshContractUI(dpCurrentId); // ✅ FIX: unified refresh
  })
  .catch(err => showToast(err.message || "Approve failed", "t-error"));
}

function returnContract(id) {
  fetch(`${API_URL}/api/contracts/request/${id}/return`, { method: "PUT" })
    .then(res => {
      // ✅ FIX (Change 5): check res.ok before claiming success, and use
      // the shared refreshContractUI() helper instead of a bespoke
      // renderContracts()+dpContract() pair, so this action refreshes the
      // same way every other contract action does.
      if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
      showToast("Contract returned", "t-success");
      addLog("REQUEST", "CONTRACT",
        `Returned contract | ${_currentContract?.other_party || id}`, id);
      refreshContractUI(dpCurrentId);
    })
    .catch(err => showToast(err.message || "Return failed", "t-error"));
}

function cancelRequest(id) {
  fetch(`${API_URL}/api/contracts/request/${id}`, { method: "DELETE" })
    .then(res => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
      showToast("Request cancelled", "t-warning");
      addLog("REQUEST", "CONTRACT",
        `Cancelled request | ${_currentContract?.other_party || id}`, id);
      refreshContractUI(dpCurrentId); // ✅ FIX: also refresh the table, not just the DP
    })
    .catch(err => showToast(err.message || "Cancel failed", "t-error"));
}

function denyRequest(id) {
  fetch(`${API_URL}/api/contracts/request/${id}/deny`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    // ✅ FIX (Change 3): previously sent NO body — the backend now requires
    // admin_id to verify super_admin role server-side.
    body: JSON.stringify({ admin_id: currentUser.user_id })
  })
    .then(res => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
      showToast("Request denied", "t-warning");
      addLog("REQUEST", "CONTRACT",
        `Denied request | ${_currentContract?.other_party || id}`, id);
      refreshContractUI(dpCurrentId); // ✅ FIX: unified refresh
    })
    .catch(err => showToast(err.message || "Deny failed", "t-error"));
}

function toggleValidity() {
  const type = document.getElementById("con-f-type").value;

  // Show/hide year field
  const yearEl = document.getElementById("con-year");
  if (yearEl) yearEl.style.display = type === "YEAR" ? "block" : "none";

  // Show/hide range fields
  const rangeEl  = document.getElementById("con-range");
  const range2El = document.getElementById("con-range2");
  if (rangeEl)  rangeEl.style.display  = type === "RANGE" ? "block" : "none";
  if (range2El) range2El.style.display = type === "RANGE" ? "block" : "none";

  // ✅ Show NA notice
  const naNotice = document.getElementById("con-na-notice");
  if (naNotice) naNotice.style.display = type === "NA" ? "block" : "none";
}


let _contractRefreshInFlight = false;
 
async function refreshContractUI(id = null) {
  _contractRefreshInFlight = true;
  try {
    await renderContracts();
    if (dpCurrentType === "contracts" && (id || dpCurrentId)) {
      await dpContract(id || dpCurrentId);
    }
  } finally {
    _contractRefreshInFlight = false;
  }
}
 


























/* ──────────────────────────────────────────────────────────────
   FINANCIAL DOCUMENTS
────────────────────────────────────────────────────────────── */

const FIN_CATEGORY_MAP = {
  "Check Voucher": "CV",
  "Official Receipt": "OR",
  "Sales Invoice": "SI",
  "Purchase Order": "PO"
  // ✅ add more later here
};

// ── Filter/pagination state ──
let finSearchQuery    = '';
let finFilterCategory = 'all';
let finFilterLocation = 'all';
let currentFinPage    = 1;
const finPerPage      = 20;
let _allFinance       = [];

function _finRangeStr(f) {
  const start = String(f.range_start).padStart(4,'0');
  const end   = String(f.range_end).padStart(4,'0');
  return `${f.category_code}${f.year}${start} - ${f.category_code}${f.year}${end}`;
}

function applyFinFilters() {
  finFilterCategory = document.getElementById('fin-filter-category').value;
  finFilterLocation = document.getElementById('fin-filter-location').value;
  currentFinPage    = 1;
  _renderFinTable();
}

function _filterFinance(data) {
  return data.filter(f => {

    // Search — year, category, folder #, range
    if (finSearchQuery) {
      const haystack = `${f.year} ${f.category} ${f.folder_number} ${_finRangeStr(f)}`.toLowerCase();
      if (!haystack.includes(finSearchQuery)) return false;
    }

    // Category filter
    if (finFilterCategory !== 'all' && f.category !== finFilterCategory) return false;

    // Location filter
    if (finFilterLocation !== 'all' && f.location !== finFilterLocation) return false;

    return true;
  });
}

function _renderFinPagination(total) {
  const container = document.getElementById('fin-pagination-container');
  if (!container) return;

  const totalPages = Math.ceil(total / finPerPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentFinPage === 1;
  prev.onclick = () => { currentFinPage--; _renderFinTable(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentFinPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => { currentFinPage = i; _renderFinTable(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentFinPage === totalPages;
  next.onclick = () => { currentFinPage++; _renderFinTable(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

function _renderFinTable() {
  const filtered  = _filterFinance(_allFinance);
  const total     = filtered.length;
  const start     = (currentFinPage - 1) * finPerPage;
  const paginated = filtered.slice(start, start + finPerPage);

  const tbody = document.getElementById('fin-tbody');
  tbody.innerHTML = "";

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--slate-400)">No folders found.</td></tr>`;
  } else {
    paginated.forEach(f => {
      const tr = document.createElement("tr");
      tr.className = "tr-clickable";

      tr.innerHTML = `
        <td>${f.year}</td>
        <td>${f.folder_number}</td>
        <td>${f.category}</td>
        <td>${_finRangeStr(f)}</td>
        <td>${f.location}</td>
      `;

      tr.addEventListener("click", () => {
        openDP("finance", f.finance_id, tr);
      });

      tbody.appendChild(tr);
    });
  }

  document.getElementById("fin-ct").innerText = total + " folders";
  _renderFinPagination(total);
}

async function renderFinance() {
  const res  = await fetch(`${API_URL}/api/finance-documents`);
  _allFinance = await res.json();
  currentFinPage = 1;
  _renderFinTable();
}

async function saveFinance() {

  const category = document.getElementById("fin-f-cat").value;

  let existing = null;

  if (editFinanceId) {
    const res = await fetch(`${API_URL}/api/finance-documents/${editFinanceId}`);
    existing = await res.json();
  }

  const payload = {
    year: document.getElementById("fin-f-year").value,
    folder_number: document.getElementById("fin-f-folder").value,
    category,
    category_code: FIN_CATEGORY_MAP[category],
    range_start: parseInt(document.getElementById("fin-f-start").value),
    range_end: parseInt(document.getElementById("fin-f-end").value),
    remarks: document.getElementById("fin-f-remarks").value,

    // ✅ FIX HERE
    location: existing ? existing.location : "STORAGE"
  };

  const url = editFinanceId
    ? `${API_URL}/api/finance-documents/${editFinanceId}`
    : `${API_URL}/api/finance-documents`;

  const method = editFinanceId ? "PUT" : "POST";

  await fetch(url, {
    method,
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });

  const actionType = editFinanceId ? "UPDATE" : "CREATE";

  const year = document.getElementById("fin-f-year").value;
  const start = String(document.getElementById("fin-f-start").value).padStart(4, '0');
  const end   = String(document.getElementById("fin-f-end").value).padStart(4, '0');
  const category_code = FIN_CATEGORY_MAP[category];

  addLog(
    actionType,
    "FINANCE",
    `${actionType === "CREATE" ? "Added" : "Updated"} ${category} | ${category_code}${year}${start} - ${category_code}${year}${end}`,
    editFinanceId || null
  );
  showToast(editFinanceId ? "Document Updated" : "Document Saved", "t-success");

  editFinanceId = null;

  closeM("m-add-fin");
  renderFinance();

  if (dpOpen && dpCurrentType === "finance") {
    dpFinance(dpCurrentId);
  }
}

let deleteFinanceId = null;

function deleteFinance(id) {
  deleteFinanceId = id;
  openM("m-confirm-fin-del");
}

function confirmDeleteFinance() {

  fetch(`${API_URL}/api/finance-documents/${deleteFinanceId}`)
    .then(res => res.json())
    .then(f => {

      const start = String(f.range_start).padStart(4, '0');
      const end   = String(f.range_end).padStart(4, '0');

      const range = `${f.category_code}${f.year}${start} - ${f.category_code}${f.year}${end}`;

      return fetch(`${API_URL}/api/finance-documents/${deleteFinanceId}`, {
        method: "DELETE"
      }).then(() => ({ f, range }));
    })
    .then(({ f, range }) => {

      showToast("Document Deleted", "t-warning");
      closeM("m-confirm-fin-del");

      addLog(
        "DELETE",
        "FINANCE",
        `Deleted ${f.category} | ${range}`,
        deleteFinanceId
      );

      renderFinance();
    });
}

async function dpFinance(id) {
  const res = await fetch(`${API_URL}/api/finance-documents`);
  const data = await res.json();

  const f = data.find(x => x.finance_id === id);
  if (!f) return;

  setDPHeader('📁', '#eff6ff', f.category, "Folder #" + f.folder_number);

  const start = String(f.range_start).padStart(4,'0');
  const end   = String(f.range_end).padStart(4,'0');

  const range = `${f.category_code}${f.year}${start} - ${f.category_code}${f.year}${end}`;

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">📋 Details</div>
      <div class="dp-grid">
        ${dpField("Year", f.year)}
        ${dpField("Folder #", f.folder_number)}
        ${dpField("Category", f.category)}
        ${dpField("Code", f.category_code)}
        ${dpField("Range", range)}
        ${dpField(
          "Location",
          `<span class="badge ${f.location === 'STORAGE' ? 'b-green' : 'b-blue'}">
            ${f.location}
          </span>
          <button class="btn btn-xs btn-outline"
            onclick="event.stopPropagation(); toggleFinanceLocation(${f.finance_id})">
            🔄
          </button>`
        )}
      </div>
    </div>

    ${f.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', f.remarks)}</div></div>` : ''}

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm" onclick="editFinance(${f.finance_id})">✏️ Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteFinance(${f.finance_id})">🗑️ Delete</button>
      </div>
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}

let editFinanceId = null;
async function editFinance(id) {
  const res = await fetch(`${API_URL}/api/finance-documents`);
  const data = await res.json();

  const f = data.find(x => x.finance_id === id);
  if (!f) return;

  editFinanceId = id;

  openM("m-add-fin");

  setTimeout(() => {
    const catSelect = document.getElementById("fin-f-cat");

    loadFinanceCategories();
    catSelect.value = f.category;

    document.getElementById("fin-f-start").value =
      String(f.range_start).padStart(4, '0');

    document.getElementById("fin-f-end").value =
      String(f.range_end).padStart(4, '0');

    document.getElementById("fin-f-year").value = f.year;
    document.getElementById("fin-f-folder").value = f.folder_number;
    document.getElementById("fin-f-remarks").value = f.remarks || "";

  }, 100);
}

function loadFinanceCategories() {
  const select = document.getElementById("fin-f-cat");

  select.innerHTML = '<option value="">Select Category</option>';

  Object.keys(FIN_CATEGORY_MAP).forEach(cat => {
    select.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

function autoSetCode() {
  const category = document.getElementById("fin-f-cat").value;
  const code = FIN_CATEGORY_MAP[category] || "";

  document.getElementById("fin-f-code").value = code;
}

async function toggleFinanceLocation(id) {

  const res = await fetch(`${API_URL}/api/finance-documents/${id}`);
  const f = await res.json();

  if (!f) return;

  const newLoc = f.location === "STORAGE" ? "OFFICE" : "STORAGE";

  // ✅ prepare formatted range
  const start = String(f.range_start).padStart(4, '0');
  const end   = String(f.range_end).padStart(4, '0');

  const range = `${f.category_code}${f.year}${start} - ${f.category_code}${f.year}${end}`;

  await fetch(`${API_URL}/api/finance-documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...f,
      location: newLoc
    })
  });

  showToast("Location updated", "t-success");

  // ✅ FIXED LOG ✅🔥
  addLog(
    "UPDATE",
    "FINANCE",
    `Moved ${f.category} | ${range} → ${newLoc}`,
    id
  );

  renderFinance();

  // ✅ FIXED REFRESH ✅🔥
  if (dpCurrentType === "finance") {
    dpFinance(id);
  }
}


function openAddFinance() {
  editFinanceId = null;

  openM("m-add-fin");

  const catSelect = document.getElementById("fin-f-cat");

  loadFinanceCategories();

  catSelect.disabled = false; 
  catSelect.value = ""; 
}













/* ──────────────────────────────────────────────────────────────
   SYSTEM LOGS
────────────────────────────────────────────────────────────── */
let logs = [];
let logId = 1;
let logSearchQuery   = '';
let logFilterAction  = 'all';
let logFilterModule  = 'all';
let logFilterDate    = 'all';
let logDateFrom      = '';
let logDateTo        = '';
let currentLogPage   = 1;

const logsPerPage    = 20;
const LOG_ICONS = { LOGIN:'🔐',LOGOUT:'🚪',CREATE:'✅',UPDATE:'✏️',DELETE:'🗑️',DELIVER:'📦',WITHDRAW:'➖',SYSTEM:'⚙️' };

function applyLogFilters() {
  logFilterAction = document.getElementById('log-filter-action').value;
  logFilterModule = document.getElementById('log-filter-module').value;
  logFilterDate   = document.getElementById('log-filter-date').value;
  logDateFrom     = document.getElementById('log-date-from')?.value || '';
  logDateTo       = document.getElementById('log-date-to')?.value   || '';
  currentLogPage  = 1;

  // Show/hide custom range inputs
  const customRange = document.getElementById('log-custom-range');
  if (customRange) {
    customRange.style.display = logFilterDate === 'custom' ? 'flex' : 'none';
  }

  renderLogs();
}

function _filterLogs(logs) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return logs.filter(log => {

    // Search — user name
    if (logSearchQuery) {
      const name = (log.name || '').toLowerCase();
      if (!name.includes(logSearchQuery)) return false;
    }

    // Action filter
    if (logFilterAction !== 'all' && log.action_type !== logFilterAction) return false;

    // Module filter
    if (logFilterModule !== 'all' && log.module !== logFilterModule) return false;

    // Date filter
    if (logFilterDate !== 'all') {
      const logDate = new Date(log.date_time);

      if (logFilterDate === 'today') {
        if (logDate < today) return false;

      } else if (logFilterDate === 'week') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        if (logDate < weekStart) return false;

      } else if (logFilterDate === 'month') {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        if (logDate < monthStart) return false;

      } else if (logFilterDate === 'custom') {
        if (logDateFrom) {
          const from = new Date(logDateFrom);
          if (logDate < from) return false;
        }
        if (logDateTo) {
          const to = new Date(logDateTo);
          to.setHours(23, 59, 59, 999);
          if (logDate > to) return false;
        }
      }
    }

    return true;
  });
}

function _renderLogPagination(total) {
  const container = document.getElementById('log-pagination-container');
  if (!container) return;

  const totalPages = Math.ceil(total / logsPerPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentLogPage === 1;
  prev.onclick = () => { currentLogPage--; renderLogs(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentLogPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => { currentLogPage = i; renderLogs(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentLogPage === totalPages;
  next.onclick = () => { currentLogPage++; renderLogs(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

async function renderLogs() {
  try {
    const res  = await fetch(`${API_URL}/api/logs`);
    const logs = await res.json();

    const filtered  = _filterLogs(logs);
    const total     = filtered.length;
    const start     = (currentLogPage - 1) * logsPerPage;
    const paginated = filtered.slice(start, start + logsPerPage);

    const tbody = document.getElementById('log-tbody');
    tbody.innerHTML = '';

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--slate-400)">No logs found.</td></tr>`;
    } else {
      paginated.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'tr-clickable';
        tr.innerHTML = `
          <td style="font-size:11px; font-family:var(--mono)">${new Date(log.date_time).toLocaleString()}</td>
          <td>${log.name || '—'}</td>
          <td><span class="log-action-badge ${_logActionCls(log.action_type)}">${log.action_type}</span></td>
          <td><span class="badge b-slate b-none">${log.module}</span></td>
          <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px">${log.description || '—'}</td>
          <td>${log.performed_by || '—'}</td>
        `;
        tr.addEventListener('click', () => openDP('log', log.log_id, tr));
        tbody.appendChild(tr);
      });
    }

    document.getElementById('log-ct').textContent = `${total} entries`;
    _renderLogPagination(total);

  } catch (err) {
    console.error(err);
    showToast('Failed to load logs', 't-error');
  }
}

function _logActionCls(action) {
  const map = {
    CREATE:   'la-create',
    UPDATE:   'la-update',
    DELETE:   'la-delete',
    DELIVER:  'la-deliver',
    WITHDRAW: 'la-withdraw',
    LOGIN:    'la-system',
    LOGOUT:   'la-system',
  };
  return map[action] || 'la-system';
}

async function exportLogs() {
  try {
    const res  = await fetch(`${API_URL}/api/logs`);
    const logs = await res.json();
    const filtered = _filterLogs(logs);

    if (!filtered.length) { showToast('No logs to export', 't-error'); return; }

    const headers = ['Timestamp', 'User', 'Action', 'Module', 'Description', 'Performed By'];
    const rows = filtered.map(l => [
      `"${new Date(l.date_time).toLocaleString()}"`,
      `"${l.name || ''}"`,
      `"${l.action_type || ''}"`,
      `"${l.module || ''}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${l.performed_by || ''}"`
    ].join(','));

    const csv  = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `SystemLogs_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Logs exported', 't-success');
  } catch (err) {
    console.error(err);
    showToast('Export failed', 't-error');
  }
}

function addLog(action, module, desc, ref='—') {
  if (!currentUser) return;

  fetch(`${API_URL}/api/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: currentUser.user_id,
      action_type: action,
      module: module,
      description: desc,
      reference_type: ref
    })
  }).catch(err => console.error("Log error:", err));
}

function dpLog(id) {
  // dp body is already rendered from the row click
  // fetch single log for detail panel
  fetch(`${API_URL}/api/logs`)
    .then(r => r.json())
    .then(logs => {
      const l = logs.find(x => x.log_id === id);
      if (!l) return;

      const clsMap = {
        CREATE:'la-create', UPDATE:'la-update', DELETE:'la-delete',
        DELIVER:'la-deliver', WITHDRAW:'la-withdraw',
        LOGIN:'la-system', LOGOUT:'la-system'
      };

      setDPHeader(
        '📜', '#f8fafc',
        `Log #${l.log_id}`,
        l.module
      );

      document.getElementById('dp-body').innerHTML = `
        <div class="dp-section">
          <div class="dp-section-hd">📜 Log Entry</div>
          <div class="dp-grid">
            ${dpField('Log ID',      `#${l.log_id}`,   'mono')}
            ${dpField('Timestamp',   new Date(l.date_time).toLocaleString(), 'mono')}
            ${dpField('User',        l.name || '—')}
            ${dpField('Action',      `<span class="log-action-badge ${clsMap[l.action_type] || 'la-system'}">${l.action_type}</span>`)}
            ${dpField('Module',      l.module)}
            ${dpField('Performed By',l.performed_by || '—')}
            ${dpFieldFull('Description', l.description || '—')}
          </div>
        </div>`;

      document.getElementById('dp-footer').style.display = 'none';
    });
}

function clearLogs() {
  if (!confirm('Clear all system logs? This cannot be undone.')) return;
  logs = [];
  logId = 1;
  renderLogs();
  showToast('Logs cleared','t-warning');
}


/* 
USER MANAGEMENT 
*/

/* ── DETAIL PANEL ───────────────────────────────────────── */
function dpUser(id) {
  const u = _allUsers.find(x => x.user_id === id);
  if (!u) return;

  const roleCls = {
    super_admin: 'b-red',
    admin:       'b-amber',
    employee:    'b-green',
    intern:      'b-blue',
  }[u.role] || 'b-slate';

  setDPHeader('👤', '#eff6ff', u.name, u.role);

  const isSelf      = currentUser.user_id === u.user_id;
  const isSuper     = u.role === 'super_admin';
  const canModify   = isAdminUser() && !isSuper;

  document.getElementById('dp-body').innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">👤 User Details</div>
      <div class="dp-grid">
        ${dpField('Name',       u.name)}
        ${dpField('Email',      u.email)}
        ${dpField('Department', u.department || '—')}
        ${dpField('Role',       `<span class="badge ${roleCls}">${u.role}</span>`)}
      </div>
    </div>

    ${isAdminUser() ? `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${canModify ? `
          <button class="btn btn-primary btn-sm"
            onclick="editUser(${u.user_id})">✏️ Edit</button>
        ` : ''}
        <button class="btn btn-outline btn-sm"
          onclick="resetPassword(${u.user_id}, '${u.name}', '${u.email}')">🔑 Reset Password</button>
        ${canModify ? `
          <button class="btn btn-red btn-sm"
            onclick="deleteUser(${u.user_id}, '${u.name}', '${u.email}', '${u.role}')">🗑️ Delete</button>
        ` : `<span class="td-muted" style="margin-left:6px">Edit/Delete disabled for Super Admin</span>`}
      </div>
    </div>` : ''}
  `;

  document.getElementById('dp-footer').style.display = 'none';
}










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

  /* ── Formatted date header ─────────────────────────────── */
  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

  /* ── Fetch all data concurrently (safe) ────────────────── */
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
      safeFetch(`${API_URL}/api/contracts/requests`), // ✅ NEW (Change 2)
    ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /* ══════════════════════════════════════════════════════════
     STAT CARDS
  ══════════════════════════════════════════════════════════ */

  // 1. Total Inventory Items
  const totalInv = inventory.length;

  // 2. Low Stock Items
  const lowStock = inventory.filter(i => i.current_quantity <= i.reorder_level);

  // 3. Active Laptops
  const activeLaptops = laptops.filter(l => l.status === 'Active');

  // 4. Pending Orders (not DELIVERED / CANCELLED)
  const pendingOrders = orders.filter(o =>
    o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  );

  // Stat card values
  _setText('dc-total',    totalInv);
  _setText('dc-total-d',  `${totalInv} tracked items`);

  _setText('dc-low',      lowStock.length);
  _setText('dc-low-d',    lowStock.length
    ? `${lowStock.length} item${lowStock.length > 1 ? 's' : ''} need restocking`
    : 'All stocks OK');

  _setText('dc-laptops',   activeLaptops.length);
  _setText('dc-laptops-d', `${activeLaptops.length} of ${laptops.length} active`);

  _setText('dc-orders',   pendingOrders.length);
  _setText('dc-orders-d', pendingOrders.length
    ? `${pendingOrders.length} pending`
    : 'No pending orders');

  /* ══════════════════════════════════════════════════════════
     PANEL 1 — LOW STOCK INVENTORY
  ══════════════════════════════════════════════════════════ */

  _setText('dash-low-ct', `${lowStock.length} items`);

  if (lowStock.length === 0) {
    _setHTML('dash-low-list', _emptyMsg('All inventory levels are OK'));
  } else {
    const rows = lowStock.slice(0, 6).map(i => {
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

  /* ══════════════════════════════════════════════════════════
     PANEL 2 — PENDING / DELAYED ORDERS
  ══════════════════════════════════════════════════════════ */

  // Compute effective status (DELAYED if ETA passed)
  const enrichedOrders = orders.map(o => {
    let status = o.status;
    if (status !== 'DELIVERED' && status !== 'CANCELLED' && o.expected_delivery_date) {
      const eta = new Date(o.expected_delivery_date);
      eta.setHours(0, 0, 0, 0);
      if (eta < today) status = 'DELAYED';
    }
    return { ...o, effectiveStatus: status };
  });

  const activeOrders = enrichedOrders.filter(o =>
    !['DELIVERED', 'CANCELLED'].includes(o.effectiveStatus)
  );

  const delayedCount = activeOrders.filter(o => o.effectiveStatus === 'DELAYED').length;

  _setText('dash-order-ct', `${activeOrders.length} orders`);

  // Update the delayed badge if it exists in the orders page (reuse safely)
  const delayedBadge = document.getElementById('po-delay-ct');
  if (delayedBadge) delayedBadge.textContent = `${delayedCount} delayed`;

  if (activeOrders.length === 0) {
    _setHTML('dash-order-list', _emptyMsg('📦 No pending orders'));
  } else {
    const rows = activeOrders.slice(0, 6).map(o => {
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

  /* ══════════════════════════════════════════════════════════
     PANEL 3 — LAPTOP ALERTS
  ══════════════════════════════════════════════════════════ */

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const isMaintenanceMonth = currentMonth === 6 || currentMonth === 12;

  const laptopAlerts = [];

  laptops.forEach(lp => {
    // For Repair
    if (lp.status === 'For Repair') {
      laptopAlerts.push({ lp, reason: 'For Repair', cls: 'red' });
      return;
    }

    // Unassigned
    if (!lp.current_user_id) {
      laptopAlerts.push({ lp, reason: 'Unassigned', cls: 'amber' });
      return;
    }

    // Age check: 3+ years and assigned to intern
    if (lp.date_of_purchase) {
      const ageYears = (now - new Date(lp.date_of_purchase)) / (365.25 * 24 * 3600 * 1000);
      if (ageYears >= 3 && lp.user_role === 'intern') {
        laptopAlerts.push({ lp, reason: `${Math.floor(ageYears)}y old · Intern`, cls: 'amber' });
        return;
      }
    }
  });

  // Maintenance month global reminder
  let laptopHeader = `${laptopAlerts.length} alerts`;
  if (isMaintenanceMonth && laptops.length > 0) {
    laptopHeader = `${laptopAlerts.length} alerts · ⚠️ Check month`;
  }

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
      html += laptopAlerts.slice(0, 5).map(({ lp, reason, cls }) => `
        <div class="panel-row">
          <div class="pr-dot ${cls}"></div>
          <div style="flex:1">
            <div class="pr-name">${_esc(lp.item_description)}</div>
            <div class="pr-meta">${_esc(lp.asset_number)} · ${_esc(lp.user_name || 'No user')}</div>
          </div>
          ${badge(reason, `b-${cls}`)}
        </div>`).join('');
    }

    _setHTML('dash-maint-list', html);
  }

  /* ══════════════════════════════════════════════════════════
     PANEL 4 — VEHICLE ALERTS
  ══════════════════════════════════════════════════════════ */

  const isFirstWorkingDay = (() => {
    const d = now.getDay();   // 0=Sun, 6=Sat
    const day = now.getDate();
    return day <= 3 && d !== 0 && d !== 6;
  })();

  const vehicleAlerts = [];

  vehicles.forEach(v => {
    if (v.status === 'UNDER_MAINTENANCE') {
      vehicleAlerts.push({ v, reason: 'Under Maintenance', cls: 'blue' });
      return;
    }
    const kmUsed = (v.odometer || 0) - (v.last_maintenance_km || 0);
    const threshold = v.maintenance_threshold || 1000;
    if (kmUsed >= threshold) {
      vehicleAlerts.push({ v, reason: `${kmUsed} km since last service`, cls: 'red' });
    }
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
      html += vehicleAlerts.slice(0, 5).map(({ v, reason, cls }) => `
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

  
/* ══════════════════════════════════════════════════════════
   PANEL 5 — CONTRACTS (expiry alerts + pending requests merged)
══════════════════════════════════════════════════════════ */
 
const contractAlerts = [];
 
contracts.forEach(c => {
  // NA contracts never expire
  if (c.validity_type === 'NA') return;
 
  let expiryDate = null;
  if (c.validity_type === 'YEAR' && c.valid_year) {
    expiryDate = new Date(`${c.valid_year}-12-31`);
  } else if (c.valid_to) {
    expiryDate = new Date(c.valid_to);
  }
  if (!expiryDate) return;
 
  const daysLeft = daysFromNow(expiryDate);
  if (daysLeft < 0)        contractAlerts.push({ c, reason: 'Expired', cls: 'red', daysLeft });
  else if (daysLeft <= 30) contractAlerts.push({ c, reason: `Expires in ${daysLeft}d`, cls: 'amber', daysLeft });
});
 
// Pending requests are only meaningful/visible to admins & super_admins
const pendingContractRequests = isAdminUser()
  ? contractRequests.filter(r => r.status === 'PENDING')
  : [];
 
const totalConItems = contractAlerts.length + pendingContractRequests.length;
_setText('dash-con-ct', `${totalConItems} item${totalConItems === 1 ? '' : 's'}`);
 
if (totalConItems === 0) {
  _setHTML('dash-con-list', _emptyMsg('All contracts current — no pending requests'));
} else {
  let html = '';


  if (pendingContractRequests.length) {
    html += pendingContractRequests.slice(0, 5).map(r => `
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
    html += contractAlerts.slice(0, 5).map(({ c, reason, cls }) => `
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

  /* ══════════════════════════════════════════════════════════
     PANEL 6 — ADMIN ONLY: GLOBE + M365
  ══════════════════════════════════════════════════════════ */

  const adminPanel = document.getElementById('dash-admin-wrap');
  if (adminPanel) {
    adminPanel.style.display = isAdminUser() ? '' : 'none';
  }

  if (isAdminUser()) {
    // Globe alerts
    const globeAlerts = globe.filter(g => {
      if (g.status === 'Inactive') return false;
      const d = daysFromNow(g.renewal_date);
      return d !== null && d <= 7;
    });

    // M365 alerts
    const m365Alerts = m365.filter(m => {
      const d = daysFromNow(m.expiry_date);
      return d !== null && d <= 7;
    });

    const totalSubs = globe.filter(g => g.status === 'Active').length +
                      m365.filter(m => m.status === 'Active').length;

    _setText('dash-admin-ct', `${globeAlerts.length + m365Alerts.length} alerts`);
    _setText('dash-admin-subs', `${totalSubs} active subscriptions`);

    const allSubAlerts = [
      ...globeAlerts.map(g => ({
        name: g.employee_name,
        detail: `Globe · ${g.plan_name || '—'} · Renews ${g.renewal_date || '—'}`,
        daysLeft: daysFromNow(g.renewal_date)
      })),
      ...m365Alerts.map(m => ({
        name: m.assigned_email,
        detail: `M365 · ${m.license_type || '—'} · Expires ${m.expiry_date || '—'}`,
        daysLeft: daysFromNow(m.expiry_date)
      }))
    ];

    if (allSubAlerts.length === 0) {
      _setHTML('dash-admin-list', _emptyMsg('✅ No subscription alerts'));
    } else {
      const rows = allSubAlerts.slice(0, 5).map(a => {
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













/* ──────────────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────────────── */

function autoLogin() {
  const savedUser = sessionStorage.getItem("user");   // was localStorage

  if (!savedUser) return;

  const user = JSON.parse(savedUser);

  currentUser = {
    user_id: user.user_id,
    name: user.name,
    role: user.role,
    initials: user.name.substring(0, 2).toUpperCase()
  };

  // SHOW APP
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');

  buildSidebar();
  initAllModules();

  const savedPage = sessionStorage.getItem("currentPage"); 
  if (savedPage) {
    navigate(savedPage);
  }

  // Update UI safely
  if (typeof updateUserUI === "function") {
    updateUserUI();
  }
}

function initAllModules() {
  renderInventory();
  renderFurniture();
  renderITSupplies();
  renderLaptops();
  renderOrders();
  renderVehicles();
  renderSubscriptionsUnified()
  renderFinance();
  renderLogs();
  renderUsers();
  renderContracts();
  loadFurLocations();
  loadFinanceCategories()
  checkMonthlyOdoReminder();
  refreshDashboard();
  refreshPageActions('dashboard');

  // Keyboard: Escape closes panels/modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      if (dpOpen) closeDP();
    }
  });

  // ── Log search listener ──
  const logSearch = document.getElementById('log-search');
  if (logSearch) {
    logSearch.addEventListener('input', () => {
      logSearchQuery = logSearch.value.trim().toLowerCase();
      currentLogPage = 1;
      renderLogs();
    });
  }

  // ── User search listener ──
  const userSearch = document.getElementById('user-search');
  if (userSearch) {
    userSearch.addEventListener('input', () => {
      userSearchQuery = userSearch.value.trim().toLowerCase();
      currentUserPage = 1;
      _renderUserTable();
    });
  }

  // ── Furniture search listener ──
  const furSearch = document.getElementById('fur-search');
  if (furSearch) {
    furSearch.addEventListener('input', () => {
      furSearchQuery = furSearch.value.trim().toLowerCase();
      currentFurPage = 1;
      _renderFurTable();
    });
  }

  // ── IT Supplies search listener ──
  const itSearch = document.getElementById('it-search');
  if (itSearch) {
    itSearch.addEventListener('input', () => {
      itSearchQuery = itSearch.value.trim().toLowerCase();
      currentITPage = 1;
      _renderITTable();
    });
  }

  // ── Contracts search listener ──
  const conSearch = document.getElementById('con-search');
  if (conSearch) {
    conSearch.addEventListener('input', () => {
      conSearchQuery = conSearch.value.trim().toLowerCase();
      currentConPage = 1;
      _renderConTable();
    });
  }

  // ── Finance search listener ──
  const finSearch = document.getElementById('fin-search');
  if (finSearch) {
    finSearch.addEventListener('input', () => {
      finSearchQuery = finSearch.value.trim().toLowerCase();
      currentFinPage = 1;
      _renderFinTable();
    });
  }

  // ── Laptop search listener ──
  const lpSearch = document.getElementById('lp-search');
  if (lpSearch) {
    lpSearch.addEventListener('input', () => {
      lpSearchQuery = lpSearch.value.trim().toLowerCase();
      currentLpPage = 1;
      _renderLpTable();
    });
  }

  // ── Purchase Orders search listener ──
  const poSearch = document.getElementById('po-search');
  if (poSearch) {
    poSearch.addEventListener('input', () => {
      poSearchQuery = poSearch.value.trim().toLowerCase();
      currentPOPage = 1;
      _renderPOTable();
    });
  }

  // ── Insurance search listener ──
  const insSearch = document.getElementById('ins-search');
  if (insSearch) {
    insSearch.addEventListener('input', () => {
      insSearchQuery = insSearch.value.trim().toLowerCase();
      currentInsPage = 1;
      _renderInsTable();
    });
  }
}

let lastRequestCheck = 0;
 
setInterval(async () => {
  if (document.hidden) return;
  if (_contractRefreshInFlight) return; // ✅ FIX: don't race a live action refresh
 
  try {
    const res = await fetch(`${API_URL}/api/contracts/requests`);
    const data = await res.json();
 
    const latestTime = new Date(data[0]?.request_date || 0).getTime();
 
    if (latestTime !== lastRequestCheck) {
      lastRequestCheck = latestTime;
 
      await renderContracts();
 
      if (dpOpen && dpCurrentType === "contracts") {
        await dpContract(dpCurrentId);
      }
    }
  } catch (e) {
    console.error("Polling error", e);
  }
}, 3000);




setInterval(() => {
  if (document.hidden) return;
  if (currentPage !== "dashboard") return;
  // refreshDashboard() already uses _setText/_setHTML which only
  // mutate individual element text/innerHTML — no full re-render.
  refreshDashboard();
}, 5 * 60 * 1000);










/* ──────────────────────────────────────────────────────────────
   LOGS
────────────────────────────────────────────────────────────── */
window.onload = function () {
  autoLogin();
};