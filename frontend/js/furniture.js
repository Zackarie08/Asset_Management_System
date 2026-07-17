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

// ✅ CHANGED: now delegates to the shared sliding-window pagination helper
function _renderFurPagination(total) {
  renderPaginationControls('fur-pagination-container', total, furPerPage, currentFurPage, (newPage) => {
    currentFurPage = newPage;
    _renderFurTable();
  });
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
      Good:     'b-green',
      Damaged:  'b-red',
      Disposed: 'b-slate'
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
  const condEl = document.getElementById('fur-f-condition');
  if (condEl) condEl.value = 'Good'; // ✅ NEW
}

function saveFurniture() {
  const name      = document.getElementById('fur-f-name').value.trim();
  const qty       = document.getElementById('fur-f-qty').value;
  const date      = document.getElementById('fur-f-date').value;
  const price     = document.getElementById('fur-f-price').value;
  const loc       = document.getElementById('fur-f-loc').value;
  const remarks   = document.getElementById('fur-f-remarks').value;
  const condition = document.getElementById('fur-f-condition').value;
  const supplier         = document.getElementById('fur-f-supplier')?.value.trim() || '';          // ✅ NEW
  const supplier_contact = document.getElementById('fur-f-supplier-contact')?.value.trim() || '';  // ✅ NEW

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
      furniture_name: name,
      quantity: qty,
      date_of_purchase: date,
      price,
      remarks,
      current_location: loc,
      condition,
      supplier, supplier_contact,             // ✅ NEW
      user_id: currentUser.user_id,
      performed_by: currentUser.name,
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

  document.getElementById('fur-f-name').value      = f.furniture_name;
  document.getElementById('fur-f-qty').value       = f.quantity;
  document.getElementById('fur-f-date').value      = f.date_of_purchase ? new Date(f.date_of_purchase).toISOString().slice(0,10) : '';
  document.getElementById('fur-f-price').value     = f.price || '';
  document.getElementById('fur-f-loc').value       = f.current_location;
  document.getElementById('fur-f-remarks').value   = f.remarks || '';
  document.getElementById('fur-f-condition').value = f.condition || 'Good';
  const supEl = document.getElementById('fur-f-supplier');            // ✅ NEW
  if (supEl) supEl.value = f.supplier || '';
  const supCEl = document.getElementById('fur-f-supplier-contact');   // ✅ NEW
  if (supCEl) supCEl.value = f.supplier_contact || '';
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
        ${dpField('Supplier', f.supplier || '—')}
        ${dpField('Supplier Contact', f.supplier_contact || '—')}
      </div>
    </div>

    ${f.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', f.remarks)}</div></div>` : ''}

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${isAdminUser() ? `
          <button class="btn btn-primary btn-sm" onclick="editFur(${f.office_furniture_id})">✏️ Edit</button>
          <button class="btn btn-red btn-sm" onclick="deleteFur(${f.office_furniture_id}, '${f.furniture_name.replace(/'/g,"\\'")}')">🗑️ Delete</button>
        ` : ''}
        ${itemHistoryButton('furniture', f.office_furniture_id, f.furniture_name)}
      </div>
    </div>
  `;

  document.getElementById('dp-footer').style.display = 'none';
}

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.furniture = dpFurniture;