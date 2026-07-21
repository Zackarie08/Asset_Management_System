
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

// ✅ CHANGED: now delegates to the shared sliding-window pagination helper
function _renderITPagination(total) {
  renderPaginationControls('it-pagination-container', total, itPerPage, currentITPage, (newPage) => {
    currentITPage = newPage;
    _renderITTable();
  });
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

  setDPHeader('plug', '#eef2ff', it.asset_name, 'IT Supply');

  let openBorrows = [];
  try {
    const res = await fetch(`${API_URL}/api/borrow-return/itsupplies/${id}`);
    openBorrows = await res.json();
  } catch { /* ignore */ }
  const currentlyOut = openBorrows.filter(b => b.status === 'BORROWED');

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  const listHTML = openBorrows.length ? `
    <ul class="mh-list">
      ${openBorrows.map(b => `
        <li class="mh-item">
          <div class="mh-dot ${b.status === 'BORROWED' ? 'repair' : 'good'}"></div>
          <div style="flex:1">
            <div class="mh-cond info">${b.status === 'BORROWED' ? '<i data-lucide="package-minus"></i> Borrowed' : '<i data-lucide="package-check"></i> Returned'} — ${b.quantity} unit(s)</div>
            <div class="mh-date">${b.borrowed_by_name} · ${formatDateHuman(b.borrow_date)}</div>
            ${b.borrow_remarks ? `<div class="mh-remarks"><i data-lucide="sticky-note"></i> ${b.borrow_remarks}</div>` : ''}
            ${b.status === 'RETURNED' ? `<div class="mh-remarks"><i data-lucide="corner-up-left"></i> Returned by ${b.returned_by_name} · ${formatDateHuman(b.return_date)}</div>` : ''}
          </div>
          ${isAdmin && b.status === 'BORROWED' ? `<button class="btn btn-xs btn-green" onclick="openReturnItem(${b.borrow_id}, '${it.asset_name.replace(/'/g,"\\'")}')"><i data-lucide="check"></i> Mark Returned</button>` : ''}
        </li>`).join('')}
    </ul>` : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No borrow history yet.</div>`;

  document.getElementById('dp-body').innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="clipboard-list"></i> Asset Details</div>
      <div class="dp-grid">
        ${dpFieldFull('Asset Name', `<strong>${it.asset_name}</strong>`)}
        ${dpField('Serial / Model', it.serial_number || '—', 'mono')}
        ${dpField('Quantity', it.quantity)}
        ${dpField('Date Purchased', it.date_of_purchase ? new Date(it.date_of_purchase).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—')}
        ${dpField('Price', it.price ? '₱' + Number(it.price).toLocaleString() : '—')}
        ${dpField('Supplier', it.supplier || '—')}
        ${dpField('Supplier Contact', it.supplier_contact || '—')}
        ${dpField('Location', it.location_name || '—')}
        ${dpField('Status', it.status ? `<span class="badge ${statusCls}">${it.status}</span>` : '—')}
        ${dpField('Warranty', _warrantyBadge(it.warranty_end_date))}
        ${dpField('Warranty Expiry', it.warranty_end_date ? new Date(it.warranty_end_date).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—', 'mono')}
      </div>
    </div>

    ${it.remarks ? `<div class="dp-section"><div class="dp-section-hd"><i data-lucide="sticky-note"></i> Remarks</div><div class="dp-grid">${dpFieldFull('Notes', it.remarks)}</div></div>` : ''}

    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
      <div class="dp-action-row">
        ${isAdmin ? `<button class="btn btn-amber btn-sm" onclick="openBorrowItem(${it.it_supplies_id},'${it.asset_name.replace(/'/g,"\\'")}','itsupplies',${it.quantity})"><i data-lucide="package-minus"></i> Borrow</button>` : ''}
        ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="editIT(${it.it_supplies_id})"><i data-lucide="pencil"></i> Edit</button>` : ''}
        ${itemHistoryButton('itsupplies', it.it_supplies_id, it.asset_name)}
        ${isAdmin ? `<button class="btn btn-red btn-sm" onclick="deleteIT(${it.it_supplies_id}, '${it.asset_name.replace(/'/g,"\\'")}')"><i data-lucide="trash-2"></i> Delete</button>` : ''}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="package-minus"></i> Borrow / Return ${currentlyOut.length ? `<span class="badge b-amber" style="margin-left:6px">${currentlyOut.length} out</span>` : ''}</div>
      ${listHTML}
    </div>
  `;

  document.getElementById('dp-footer').style.display = 'none';

  if (window.lucide) lucide.createIcons();
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
  const supplier         = document.getElementById('it-f-supplier')?.value.trim() || '';          // ✅ NEW
  const supplier_contact = document.getElementById('it-f-supplier-contact')?.value.trim() || '';  // ✅ NEW

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
      date_of_purchase: date || null,
      price: price || null,
      warranty_end_date: warranty || null,
      location_id:      loc,
      status,
      remarks,
      supplier, supplier_contact,   // ✅ NEW
      user_id: currentUser.user_id,
      performed_by: currentUser.name,
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
  const supEl = document.getElementById('it-f-supplier');            // ✅ NEW
  if (supEl) supEl.value = it.supplier || '';
  const supCEl = document.getElementById('it-f-supplier-contact');   // ✅ NEW
  if (supCEl) supCEl.value = it.supplier_contact || '';
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
        ? '<span class="badge b-blue" style="margin-left:4px"><i data-lucide="package-minus"></i> Borrowed</span>'
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

  if (window.lucide) lucide.createIcons();
}


if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.itsupplies = dpITSupplies;