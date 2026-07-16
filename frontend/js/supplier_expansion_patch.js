/* ============================================================
   supplier_expansion_patch.js — Part 6
   ============================================================
   Adds Supplier + Supplier Contact support to Inventory and
   Office Furniture (IT Supplies' save/edit/detail-panel supplier
   support is already handled directly in the updated
   itsupplies_borrow_patch.js, since that file already owns
   saveITSupply/editIT/dpITSupplies as the last-loaded version).

   Requires the index.html changes in Supplier_Information_Expansion.md
   (adds #inv-f-supplier/#inv-f-supplier-contact and
   #fur-f-supplier/#fur-f-supplier-contact inputs to the Add/Edit
   modals) and the backend/migration changes in the same doc.

   Load as the LAST script in index.html (after inventory.js,
   inventory_borrow_wine_patch.js, main.js, furniture_history_patch.js)
   so these overrides win, per the project's documented
   last-loaded-wins pattern.
   ============================================================ */

/* ════════════════ INVENTORY ════════════════ */

function saveInvItem() {
  const name = document.getElementById("inv-f-name").value;
  const qty = document.getElementById("inv-f-qty").value;
  const category = document.getElementById("inv-f-cat").value;
  const limit = document.getElementById("inv-f-reorder").value;
  const price = document.getElementById("inv-f-price").value;
  const unit = document.getElementById("inv-f-unit").value;
  const remarks = document.getElementById("inv-f-remarks").value;
  const location = document.getElementById("inv-f-loc").value;
  const supplier = document.getElementById("inv-f-supplier")?.value.trim() || '';                 // ✅ NEW
  const supplier_contact = document.getElementById("inv-f-supplier-contact")?.value.trim() || '';  // ✅ NEW

  if (!name || !qty || !category || !limit || !price || !unit || !location) {
    showToast("Please fill all required fields", "t-error");
    return;
  }

  if (!selectState["inv-f-performed"]) {
    showToast("Select a valid user", "t-error");
    return;
  }

  if (invEditId) {
    fetch(`${API_URL}/api/inventory/${invEditId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, category, quantity_limit: limit, price, unit, remarks,
        location_id: location, supplier, supplier_contact,           // ✅ NEW
        user_id: currentUser.user_id,
        performed_by: document.getElementById("inv-f-performed").value
      })
    }).then(() => {
      renderInventory();
      closeM('m-add-inv');
      showToast("Item edited", "t-success");
      invEditId = null;
    });

  } else {
    fetch(`${API_URL}/api/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, qty, category, quantity_limit: limit, price, unit, remarks,
        supplier, supplier_contact,                                   // ✅ NEW
        user_id: currentUser.user_id,
        performed_by: document.getElementById("inv-f-performed").value,
        location_id: location
      })
    }).then(() => {
      renderInventory();
      closeM('m-add-inv');
      showToast("Item added", "t-success");
      invEditId = null;
    });
  }
}

window.openEditInv = async function(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();
  const item = items.find(i => i.inventory_gen_id === id);
  if (!item) return;

  invEditId = id;
  closeDP();

  document.getElementById('m-add-inv-title').textContent = '✏️ Edit Inventory Item';
  document.getElementById('inv-f-name').value = item.item_name;
  document.getElementById('inv-f-cat').value = item.category;
  document.getElementById('inv-f-qty').value = item.current_quantity;
  document.getElementById('inv-f-qty').disabled = true;
  document.getElementById('inv-f-unit').value = item.unit;
  document.getElementById('inv-f-reorder').value = item.reorder_level;
  document.getElementById('inv-f-price').value = item.price || '';
  document.getElementById('inv-f-loc').value = item.location_id;
  document.getElementById('inv-f-remarks').value = item.remarks || '';
  const supEl = document.getElementById('inv-f-supplier');            // ✅ NEW
  if (supEl) supEl.value = item.supplier || '';
  const supCEl = document.getElementById('inv-f-supplier-contact');   // ✅ NEW
  if (supCEl) supCEl.value = item.supplier_contact || '';

  openM('m-add-inv');
  loadUsersDropdown();
  loadLocationDropdown();
};

async function dpInventory(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();

  const item = items.find(i => i.inventory_gen_id === id);
  if (!item) return;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const isLow = item.current_quantity <= item.reorder_level;
  setDPHeader('📦', '#eff6ff', item.item_name, item.category);

  const maxCapacity = Math.max(item.reorder_level * 5, 1);
  const progress = Math.min(100, Math.round((item.current_quantity / maxCapacity) * 100));
  const barColor = isLow ? '#ff4d4f' : '#52c41a';

  let html = `
    ${isLow ? `<div class="dp-alert warning">⚠️ <span class="dp-alert-text">Stock is below reorder level. Create a purchase order.</span></div>` : ''}
    <div class="prog-bar-wrap">
      <div class="prog-bar-labels"><span>Stock Level</span><span>${item.current_quantity} / ${item.reorder_level*5} ${item.unit}</span></div>
      <div class="prog-bar-track"><div class="prog-bar-fill" style="width:${progress}%;background:${barColor}"></div></div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📋 Item Details</div>
      <div class="dp-grid">
        ${dpFieldFull('Item Name', `<strong>${item.item_name}</strong>`)}
        ${dpField('Category', item.category)}
        ${dpField('Unit', item.unit)}
        ${dpField('Location', item.location_name || '-')}
        ${dpField('Price / Unit', item.price ? '₱'+item.price.toLocaleString() : null)}
        ${dpField('Total Value', item.price ? '₱'+(item.price*item.current_quantity).toLocaleString() : null)}
        ${dpField('Supplier', item.supplier || '—')}
        ${dpField('Supplier Contact', item.supplier_contact || '—')}
      </div>
    </div>

    ${item.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', item.remarks)}</div></div>` : ''}`;

  /* ── Category-specific action sets (unchanged from inventory_borrow_wine_patch.js) ── */
  if (item.category === 'Company Event Supplies') {
    html += await _buildEventSupplyActionsHTML(item, isAdmin);
  } else if (item.category === 'Wine') {
    html += await _buildWineActionsHTML(item, isAdmin);
  } else if (isAdmin) {
    html += `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-warning btn-sm" onclick="openWithdraw(${item.inventory_gen_id})">➖ Withdraw</button>
        <button class="btn btn-primary btn-sm" onclick="openCreateOrder(${item.inventory_gen_id})">📦 Create Order</button>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openEditInv(${item.inventory_gen_id})">✏️ Edit</button>
        ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}
        <button class="btn btn-red btn-sm" onclick="event.stopPropagation(); deleteInventory(${item.inventory_gen_id}, '${item.item_name.replace(/'/g, "\\'")}')">🗑️ Delete</button>
      </div>
    </div>`;
  } else {
    html += `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}</div>
    </div>`;
  }

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.inventory = dpInventory;

/* ════════════════ OFFICE FURNITURE ════════════════ */

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

/* ════════════════ IT SUPPLIES — save/edit only ════════════════
   (dpITSupplies supplier display already lives in the updated
   itsupplies_borrow_patch.js — not re-overridden here.) ════════ */

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
      date_of_purchase: date,
      price,
      warranty_end_date: warranty,
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
