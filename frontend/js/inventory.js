async function renderInventory() {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();

  const tbody = document.getElementById("inv-tbody");
  tbody.innerHTML = "";

  let low = 0;

  items.forEach(item => {
    const isLow = item.current_quantity <= item.quantity_limit;

    if (isLow) low++;

    const tr = document.createElement("tr");
    tr.className = 'tr-clickable';

    tr.addEventListener('click', () => {
      openDP('inventory', item.id, tr);
    });

    tr.innerHTML = `
      <td>${item.item_name}</td>
      <td>${item.category}</td>
      <td>${item.current_quantity}</td>
      <td>${isLow ? "⚠️ LOW" : "OK"}</td>
      <td>
        <button onclick="event.stopPropagation(); openWithdraw(${item.id})">➖</button>
        <button onclick="event.stopPropagation(); deleteItem(${item.id})">🗑️</button>
      </td>
    `;
    
    tr.className = 'tr-clickable';
    tr.addEventListener('click', () => openDP('inventory', item.id, tr));

    tbody.appendChild(tr);
  });

  document.getElementById("inv-low-ct").innerText =
    low + " low stock";
}
``

function saveInvItem() {
  const name = document.getElementById("inv-f-name").value;
  const qty = document.getElementById("inv-f-qty").value;
  const category = document.getElementById("inv-f-cat").value;
  const limit = document.getElementById("inv-f-reorder").value;
  const price = document.getElementById("inv-f-price").value;
  const unit = document.getElementById("inv-f-unit").value;
  const remarks = document.getElementById("inv-f-remarks").value;

  fetch(`${API_URL}/api/inventory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      qty,
      category,
      quantity_limit: limit,
      price,
      unit, 
      remarks
    })
  })
  .then(() => {
    renderInventory();
    closeM('m-add-inv');
  });
}

function withdrawItem(id, qty) {
  fetch(`${API_URL}/api/inventory/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id, qty })
  })
  .then(() => {
    renderInventory();
  });
}

function deleteItem(id) {
  fetch(`${API_URL}/api/inventory/${id}`, {
    method: "DELETE"
  })
  .then(() => {
    renderInventory();
  });
}

let withdrawItemId = null;
async function openWithdraw(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();
  const item = items.find(i => i.id === id);
  if (!item) return;
  withdrawItemId = id;
  document.getElementById('wd-item-name').textContent = item.item_name;
  document.getElementById('wd-current').textContent   = `${item.current_quantity} ${item.unit}`;
  document.getElementById('wd-qty').value     = '';
  document.getElementById('wd-by').value      = currentUser.name;
  document.getElementById('wd-remarks').value = '';
  openM('m-withdraw');
}

function doWithdraw() {
  const qty = parseInt(document.getElementById('wd-qty').value) || 0;

  if (qty <= 0) {
    showToast('Enter a valid quantity','t-error');
    return;
  }

  fetch(`${API_URL}/api/inventory/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: withdrawItemId,
      qty: qty
    })
  })
  .then(() => {
    closeM('m-withdraw');
    renderInventory();
    showToast('Withdraw successful','t-success');
  });
}



async function dpInventory(id) {

  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();

  const item = items.find(i => i.id === id);
  if (!item) return;
  const isAdmin = currentUser.role === 'admin';
  const isLow = item.current_quantity <= item.quantity_limit;
  setDPHeader('📦','#eff6ff', item.item_name, item.cat);

  const progress = Math.min(100, Math.round((item.current_quantity / Math.max(item.quantity_limit*2,1))*100));
  const barColor = isLow ? '#ef4444' : '#22c55e';

  let html = `
    ${isLow ? `<div class="dp-alert warning">⚠️ <span class="dp-alert-text">Stock is below reorder level. Create a purchase order.</span></div>` : ''}
    <div class="dp-status-row">${isLow ? badge('LOW STOCK','b-red') : badge('OK','b-green')}<span class="dp-status-label">Current: <strong>${item.current_quantity} ${item.unit}</strong> / Reorder at: <strong>${item.reorder}</strong></span></div>
    <div class="prog-bar-wrap">
      <div class="prog-bar-labels"><span>Stock Level</span><span>${item.current_quantity} ${item.unit}</span></div>
      <div class="prog-bar-track"><div class="prog-bar-fill" style="width:${progress}%;background:${barColor}"></div></div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📋 Item Details</div>
      <div class="dp-grid">
        ${dpFieldFull('Item Name', `<strong>${item.item_name}</strong>`)}
        ${dpField('Category', item.cat)}
        ${dpField('Unit', item.unit)}
        ${dpField('Location', item.loc)}
        ${dpField('Price / Unit', item.price ? '₱'+item.price.toLocaleString() : null)}
        ${dpField('Total Value', item.price ? '₱'+(item.price*item.current_quantity).toLocaleString() : null)}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">🏪 Supplier</div>
      <div class="supplier-card">
        <div class="sc-name">🏢 ${item.supplier||'Not specified'}</div>
        <div class="sc-note">Contact supplier directly to place a replenishment order</div>
        <span class="sc-link" onclick="showToast('Opening supplier portal for '+${JSON.stringify(item.supplier)},'t-info')">🔗 Contact Supplier</span>
      </div>
      <div class="dp-grid" style="margin-top:9px">
        ${dpField('Contact', item.contact)}
      </div>
    </div>

    ${item.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', item.remarks)}</div></div>` : ''}`;

  if (isAdmin) {
    html += `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-warning btn-sm" onclick="openWithdraw(${item.id})">➖ Withdraw</button>
        <button class="btn btn-primary btn-sm" onclick="openCreateOrder(${item.id})">📦 Create Order</button>
        <button class="btn btn-outline btn-sm" onclick="openEditInv(${item.id})">✏️ Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteInv(${item.id})">🗑️ Delete</button>
      </div>
    </div>`;
  }

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}


async function openCreateOrder(id) {
    
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();

  const item = items.find(i => i.id === id);
  if (item) {
    document.getElementById('po-f-item').value     = item.item_name;
    document.getElementById('po-f-supplier').value = item.supplier || '';
    document.getElementById('po-f-cat').value      = item.cat;
    document.getElementById('po-f-unit').value     = item.unit;
    document.getElementById('po-f-price').value    = item.price || '';
    document.getElementById('po-f-date').value     = todayStr();
  }
  openM('m-add-po');
}

async function openEditInv(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();
  const item = items.find(i => i.id === id);
  if (!item) return;
  invEditId = id;
  document.getElementById('m-add-inv-title').textContent = '✏️ Edit Inventory Item';
  document.getElementById('inv-f-name').value     = item.item_name;
  document.getElementById('inv-f-cat').value      = item.cat;
  document.getElementById('inv-f-qty').value      = item.current_quantity;
  document.getElementById('inv-f-unit').value     = item.unit;
  document.getElementById('inv-f-reorder').value  = item.reorder;
  document.getElementById('inv-f-price').value    = item.price||'';
  document.getElementById('inv-f-loc').value      = item.loc;
  document.getElementById('inv-f-supplier').value = item.supplier||'';
  document.getElementById('inv-f-contact').value  = item.contact||'';
  document.getElementById('inv-f-remarks').value  = item.remarks||'';
  openM('m-add-inv');
}

async function deleteInv(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();
  const item = items.find(i => i.id === id);
  if (!item || !confirm(`Delete "${item.item_name}"? This cannot be undone.`)) return;
  items = items.filter(i => i.id !== id);
  addLog('DELETE','Inventory',`Deleted inventory item: "${item.item_name}"`,`INV-${id}`);
  closeDP(); renderInventory();
  showToast('Item deleted','t-warning');
}


let invId = 13;
let invFilter = 'all';
let invEditId = null;

function filterInventory(cat, btn) {
  invFilter = cat;
  document.querySelectorAll('.cat-filter').forEach(b => { b.className = b.className.replace(' btn-primary','').replace('btn-outline','').trim(); b.className += ' btn-outline'; });
  btn.className = btn.className.replace('btn-outline','btn-primary');
  renderInventory();
}