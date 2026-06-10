let currentItemStock = 0;

async function renderInventory() {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();

  const tbody = document.getElementById("inv-tbody");
  tbody.innerHTML = "";

  let low = 0;

  items.forEach(item => {
    const isLow = item.current_quantity <= item.reorder_level;

    if (isLow) low++;


    const tr = document.createElement("tr");
    tr.className = 'tr-clickable';

    tr.addEventListener('click', () => {
      openDP('inventory', item.inventory_gen_id, tr);
    });


    tr.innerHTML = `
      <td>${item.item_name}</td>
      <td>${item.category}</td>
      <td>${item.current_quantity}</td>
      <td>${isLow ? "⚠️ LOW" : "OK"}</td>
      <td>
        <button onclick="event.stopPropagation(); openWithdraw(${item.inventory_gen_id})">➖</button>
        <button onclick="event.stopPropagation(); deleteItem(${item.inventory_gen_id})">🗑️</button>
      </td>
    `;
    
    tr.className = 'tr-clickable';

    tbody.appendChild(tr);
  });

  document.getElementById("inv-low-ct").innerText =
    low + " low stock";
}

function saveInvItem() {
  const name = document.getElementById("inv-f-name").value;
  const qty = document.getElementById("inv-f-qty").value;
  const category = document.getElementById("inv-f-cat").value;
  const limit = document.getElementById("inv-f-reorder").value;
  const price = document.getElementById("inv-f-price").value;
  const unit = document.getElementById("inv-f-unit").value;
  const remarks = document.getElementById("inv-f-remarks").value;
  const location = document.getElementById("inv-f-loc").value;

  if (!name || !qty || !category || !limit || !price || !unit || !location) {
    showToast("Please fill all required fields", "t-error");
    return;
  }
  
  if (!selectState["inv-f-performed"]) {
    showToast("Select a valid user", "t-error");
    return;
  }


  // ✅ CHECK MODE FIRST
  if (invEditId) {
    // ✅ UPDATE MODE ONLY
    fetch(`${API_URL}/api/inventory/${invEditId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        category,
        quantity_limit: limit,
        price,
        unit,
        remarks,
        location_id: location,

        user_id: currentUser.user_id,
        performed_by: document.getElementById("inv-f-performed").value
      })
    }).then(() => {
      renderInventory();
      closeM('m-add-inv');
      invEditId = null; // ✅ reset mode
    });

  } else {
    // ✅ ADD MODE ONLY
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
        remarks,

        user_id: currentUser.user_id,
        performed_by: document.getElementById("inv-f-performed").value,
        location_id: location
      })
    }).then(() => {
      renderInventory();
      closeM('m-add-inv');
    });
  }
}


function withdrawItem(id, qty) {

  if (!selectState["wd-by"]) {
    showToast("Select a valid user", "t-error");
    return;
  }
  fetch(`${API_URL}/api/inventory/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id,
      qty,
      user_id: currentUser.user_id,         // ✅ ADD THIS
      performed_by: document.getElementById("wd-by").value      // ✅ ADD THIS
    })
  })
  .then(() => {
    showToast("Item withdrawn", "t-success");
    renderInventory();
  });
}

function deleteItem(id) {
  fetch(`${API_URL}/api/inventory/${id}?user_id=${currentUser.user_id}&performed_by=${currentUser.name}`, {
    method: "DELETE"
  })
  .then(() => {
    showToast("Item deleted", "t-warning");
    renderInventory();
  });
}

let withdrawItemId = null;
async function openWithdraw(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();
  const item = items.find(i => i.inventory_gen_id === id);
  if (!item) return;
  withdrawItemId = id;
  currentItemStock = item.current_quantity;
  document.getElementById('wd-item-name').textContent = item.item_name;
  document.getElementById('wd-current').textContent   = `${item.current_quantity} ${item.unit}`;
  document.getElementById('wd-qty').value     = '';  
  document.getElementById('wd-by').value = "";
  selectState["wd-by"] = false; 
  document.getElementById('wd-remarks').value = '';
  openM('m-withdraw');
  loadUsersDropdown();
}

function doWithdraw() {
  const qty = parseInt(document.getElementById('wd-qty').value);
  const userVal = document.getElementById("wd-by").value;

  // extra validation
  if (!selectState["wd-by"] || !userVal) {
    showToast("Select a valid user", "t-error");
    return;
  }

  // ✅ invalid input
  if (!qty || isNaN(qty)) {
    showToast('Enter a valid quantity','t-error');
    return;
  }

  // ✅ cannot be 0 or negative
  if (qty <= 0) {
    showToast('Quantity must be greater than 0','t-error');
    return;
  }

  // ✅ cannot exceed stock 🔥
  if (qty > currentItemStock) {
    showToast('Not enough stock','t-error');
    return;
  }

  fetch(`${API_URL}/api/inventory/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: withdrawItemId,
      qty: qty,
      user_id: currentUser.user_id,       // ✅ ADD
      performed_by: document.getElementById("wd-by").value || currentUser.name     // ✅ ADD
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

  const item = items.find(i => i.inventory_gen_id === id);
  if (!item) return;
  const isAdmin = currentUser.role === 'admin';
  const isLow = item.current_quantity <= item.reorder_level;
  setDPHeader('📦','#eff6ff', item.item_name, item.category);

  const progress = Math.min(100, Math.round((item.current_quantity / Math.max(item.quantity_limit*2,1))*100));
  const barColor = isLow ? '#ef4444' : '#22c55e';

  let html = `
    ${isLow ? `<div class="dp-alert warning">⚠️ <span class="dp-alert-text">Stock is below reorder level. Create a purchase order.</span></div>` : ''}
    <div class="dp-status-row">${isLow ? badge('LOW STOCK','b-red') : badge('OK','b-green')}<span class="dp-status-label">Current: <strong>${item.current_quantity} ${item.unit}</strong> / Reorder at: <strong>${item.reorder_level}</strong></span></div>
    <div class="prog-bar-wrap">
      <div class="prog-bar-labels"><span>Stock Level</span><span>${item.current_quantity} ${item.unit}</span></div>
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
      </div>
    </div>

    ${item.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', item.remarks)}</div></div>` : ''}`;

  if (isAdmin) {
    html += `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-warning btn-sm" onclick="openWithdraw(${item.inventory_gen_id})">➖ Withdraw</button>
        <button class="btn btn-primary btn-sm" onclick="openCreateOrder(${item.inventory_gen_id})">📦 Create Order</button>
        <button class="btn btn-outline btn-sm"onclick="event.stopPropagation(); event.preventDefault(); openEditInv(${item.inventory_gen_id})">✏️ Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteInv(${item.inventory_gen_id})">🗑️ Delete</button>
      </div>
    </div>`;
  }

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}


let currentOrderItemId = null;

async function openCreateOrder(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();

  const item = items.find(i => i.inventory_gen_id === id);
  if (!item) return;

  currentOrderItemId = id;

  document.getElementById('po-f-item').value     = item.item_name;
  document.getElementById('po-f-cat').value      = item.category;
  document.getElementById('po-f-unit').value     = item.unit;
  document.getElementById('po-f-price').value    = item.price || '';
  document.getElementById('po-f-date').value     = todayStr();

  openM('m-add-po');
  loadUsersDropdown(["po-f-performed"]);
}


window.openEditInv = async function(id) {
  console.log("EDIT CLICKED:", id);

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

  openM('m-add-inv');
  loadUsersDropdown();
  loadLocationDropdown();
};

async function deleteInv(id) {
  if (!confirm("Delete this item?")) return;

  await fetch(`${API_URL}/api/inventory/${id}?user_id=${currentUser.user_id}&performed_by=${currentUser.name}`, {
    method: "DELETE"
  })


  closeDP();
  renderInventory();
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

async function loadUsersDropdown() {

  const res = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();

  const names = users.map(u => u.name);

  makeSearchable("inv-f-performed", "inv-f-list", names);
  makeSearchable("wd-by", "wd-list", names);
  makeSearchable("po-f-performed", "po-list", names);


  selects.forEach(select => {
    if (!select) return;

    select.innerHTML = "";

    users.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.name;
      opt.textContent = u.name;
      const names = users.map(u => u.name);

      makeSearchable("inv-f-performed", "inv-f-list", names);
      makeSearchable("wd-by", "wd-list", names);
      makeSearchable("po-f-performed", "po-list", names);
    });

    select.value = currentUser.name; // default selection
  });
}


function openAddInventory() {
  openM('m-add-inv');
  loadUsersDropdown(); // ✅ important
  loadLocationDropdown();
  document.getElementById('inv-f-qty').disabled = false;
}

async function loadLocationDropdown() {
  const res = await fetch(`${API_URL}/api/location`);
  const locations = await res.json();

  const selects = [
    document.getElementById("inv-f-loc"),
  ];

  selects.forEach(select => {
    if (!select) return;

    select.innerHTML = "";

    locations.forEach(loc => {
      const opt = document.createElement("option");
      opt.value = loc.location_id;       // ✅ SAVE ID
      opt.textContent = loc.location_name;
      select.appendChild(opt);
    });
  });
}