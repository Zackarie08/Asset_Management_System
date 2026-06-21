let currentItemStock = 0;

async function renderInventory() {
  const res = await fetch(`${API_URL}/api/inventory`);
  const allItems = await res.json();

  // ── Step 1: Search ──
  let filtered = searchQuery
    ? allItems.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery) ||
        item.category.toLowerCase().includes(searchQuery) ||
        (item.location_name && item.location_name.toLowerCase().includes(searchQuery))
      )
    : allItems;

  // ── Step 2: Category filter ──
  if (activeCategory !== 'all') {
    filtered = filtered.filter(item => item.category === activeCategory);
  }

// ── Step 3: Unit filter ──
  if (activeUnit !== 'all') {
    filtered = filtered.filter(item => item.unit === activeUnit);
  }

  // ── Step 3b: Location filter ──
  if (activeLocation !== 'all') {
    filtered = filtered.filter(item => item.location_name === activeLocation);
  }

  // ── Step 4: Status filter ──
  if (activeStatus === 'low') {
    filtered = filtered.filter(item => item.current_quantity <= item.reorder_level);
  } else if (activeStatus === 'active') {
    filtered = filtered.filter(item => item.current_quantity > item.reorder_level);
  }

  // ── Step 5: Sort — low stock floats to top, then A–Z within each group ──
  filtered.sort((a, b) => {
    const aLow = a.current_quantity <= a.reorder_level ? 0 : 1;
    const bLow = b.current_quantity <= b.reorder_level ? 0 : 1;
    if (aLow !== bLow) return aLow - bLow;
    return a.item_name.localeCompare(b.item_name);
  });

  // ── Step 6: Pagination slice ──
  const totalItems = filtered.length;
  const start = (currentInvPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);

  const tbody = document.getElementById("inv-tbody");
  tbody.innerHTML = "";

  const low = filtered.filter(item => item.current_quantity <= item.reorder_level).length;

  paginated.forEach(item => {
    const isLow = item.current_quantity <= item.reorder_level;

    const tr = document.createElement("tr");
    tr.className = isLow ? "tr-clickable tr-warn" : "tr-clickable";

    tr.addEventListener("click", () => {
      openDP("inventory", item.inventory_gen_id, tr);
    });

    tr.innerHTML = `
      <td>${item.item_name}</td>
      <td>${item.category}</td>
      <td>${item.current_quantity}</td>
      <td>${item.unit || "-"}</td>
      <td>${item.location_name || "-"}</td>
      <td>
        ${isLow
          ? '<span class="badge b-red">Low Stock</span>'
          : '<span class="badge b-green">Active</span>'
        }
      </td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-xs btn-outline" title="Withdraw"
            onclick="event.stopPropagation(); openWithdraw(${item.inventory_gen_id})">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="btn btn-xs btn-red" title="Delete"
            onclick="event.stopPropagation(); deleteInventory(${item.inventory_gen_id}, '${item.item_name.replace(/'/g, "\\'")}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("inv-low-ct").innerText = low + " low stock";
  document.getElementById("inv-total-ct").innerText = totalItems + " items";

  renderPagination(totalItems);
}

function renderPagination(totalItems) {
  const container = document.getElementById("pagination-container");
  if (!container) return;

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  container.innerHTML = "";

  if (totalPages <= 1) return;

  const wrap = document.createElement("div");
  wrap.className = "pagination-wrap";

  // Prev button
  const prev = document.createElement("button");
  prev.className = "btn btn-xs btn-outline pg-btn";
  prev.textContent = "← Prev";
  prev.disabled = currentInvPage === 1;
  prev.onclick = () => {
    if (currentInvPage > 1) {
      currentInvPage--;
      renderInventory();
    }
  };
  wrap.appendChild(prev);

  // Page number buttons
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = "btn btn-xs pg-btn " + (i === currentInvPage ? "btn-primary" : "btn-outline");
    btn.textContent = i;
    btn.onclick = () => {
      currentInvPage = i;
      renderInventory();
    };
    wrap.appendChild(btn);
  }

  // Next button
  const next = document.createElement("button");
  next.className = "btn btn-xs btn-outline pg-btn";
  next.textContent = "Next →";
  next.disabled = currentInvPage === totalPages;
  next.onclick = () => {
    if (currentInvPage < totalPages) {
      currentInvPage++;
      renderInventory();
    }
  };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

async function exportInventory() {
  const res = await fetch(`${API_URL}/api/inventory`);
  const allItems = await res.json();

  // ── Apply the same filter pipeline as renderInventory ──
  let filtered = searchQuery
    ? allItems.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery) ||
        item.category.toLowerCase().includes(searchQuery) ||
        (item.location_name && item.location_name.toLowerCase().includes(searchQuery))
      )
    : allItems;

  if (activeCategory !== 'all') {
    filtered = filtered.filter(item => item.category === activeCategory);
  }

  if (activeUnit !== 'all') {
    filtered = filtered.filter(item => item.unit === activeUnit);
  }

  if (activeLocation !== 'all') {
    filtered = filtered.filter(item => item.location_name === activeLocation);
  }

  if (activeStatus === 'low') {
    filtered = filtered.filter(item => item.current_quantity <= item.reorder_level);
  } else if (activeStatus === 'active') {
    filtered = filtered.filter(item => item.current_quantity > item.reorder_level);
  }

  filtered.sort((a, b) => {
    const aLow = a.current_quantity <= a.reorder_level ? 0 : 1;
    const bLow = b.current_quantity <= b.reorder_level ? 0 : 1;
    if (aLow !== bLow) return aLow - bLow;
    return a.item_name.localeCompare(b.item_name);
  });

  // ── Build CSV ──
  const headers = ["Item Name", "Category", "Quantity", "Unit", "Location", "Status"];

  const rows = filtered.map(item => {
    const status = item.current_quantity <= item.reorder_level ? "Low Stock" : "Active";
    return [
      `"${item.item_name}"`,
      `"${item.category}"`,
      item.current_quantity,
      `"${item.unit || '-'}"`,
      `"${item.location_name || '-'}"`,
      `"${status}"`
    ].join(",");
  });

  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");

  // ── Trigger download ──
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Inventory_Report_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Inventory exported successfully", "t-success");
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

      if (dpOpen && dpCurrentType === 'inventory' && dpCurrentId === invEditId) {
        dpInventory(invEditId);
      }

      invEditId = null; // ✅ reset mode
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

    if (dpOpen && dpCurrentType === 'inventory' && dpCurrentId === withdrawItemId) {
      dpInventory(withdrawItemId);
    }
  });
}



async function dpInventory(id) {

  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();

  const item = items.find(i => i.inventory_gen_id === id);
  if (!item) return;
  const isAdmin =
    currentUser.role === 'admin' ||
    currentUser.role === 'super_admin';
  const isLow = item.current_quantity <= item.reorder_level;
  setDPHeader('📦','#eff6ff', item.item_name, item.category);

  const maxCapacity = Math.max(item.reorder_level * 2, 1);
  const progress = Math.min(100, Math.round((item.current_quantity / maxCapacity) * 100));
  const barColor = isLow ? '#ff4d4f' : '#52c41a';

  let html = `
    ${isLow ? `<div class="dp-alert warning">⚠️ <span class="dp-alert-text">Stock is below reorder level. Create a purchase order.</span></div>` : ''}
    <div class="prog-bar-wrap">
      <div class="prog-bar-labels"><span>Stock Level</span><span>${item.current_quantity} / ${item.reorder_level*2} ${item.unit}</span></div>
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
        <button class="btn btn-warning btn-sm" onclick="openWithdraw(${item.inventory_gen_id})">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Withdraw
        </button>

        <button class="btn btn-primary btn-sm" onclick="openCreateOrder(${item.inventory_gen_id})">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 8l-9-5-9 5 9 5 9-5z"/>
            <path d="M3 8v8l9 5 9-5V8"/>
            <line x1="12" y1="13" x2="12" y2="21"/>
          </svg>
          Create Order
        </button>

        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); event.preventDefault(); openEditInv(${item.inventory_gen_id})">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>

        <button
          class="btn btn-red btn-sm"
          onclick="event.stopPropagation(); event.preventDefault(); event.stopImmediatePropagation(); deleteInventory(${item.inventory_gen_id}, '${item.item_name.replace(/'/g, "\\'")}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Delete
        </button>

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

let deleteInventoryId = null;
let deleteInventoryName = "";


function deleteInventory(id, name) {
  console.log("DELETE CLICKED", id, name);
  deleteInventoryId = id;
  deleteInventoryName = name;

  openM("m-confirm-inv-del"); 
}

function confirmDeleteInventory() {
  fetch(`${API_URL}/api/inventory/${deleteInventoryId}`, {
    method: "DELETE"
  })
  .then(() => {
    showToast("Inventory Item Deleted", "t-warning");

    addLog(
      "DELETE",
      "INVENTORY",
      "Deleted Inventory item: " + deleteInventoryName,
      deleteInventoryId
    );

    closeM("m-confirm-inv-del");
    renderInventory();
  });
}


let invId = 13;
let activeCategory = 'all';
let activeUnit = 'all';
let activeLocation = 'all';
let activeStatus = 'all';
let searchQuery = '';
let currentInvPage = 1;
const itemsPerPage = 20;
let invEditId = null;

function filterInventory(cat, btn) {
  activeCategory = cat;
  currentInvPage = 1;
  document.querySelectorAll('.cat-filter').forEach(b => {
    b.classList.remove('btn-primary');
    b.classList.add('btn-outline');
  });
  btn.classList.remove('btn-outline');
  btn.classList.add('btn-primary');
  renderInventory();
}

function applyInvFilters() {
  activeUnit     = document.getElementById('inv-filter-unit').value;
  activeLocation = document.getElementById('inv-filter-location').value;
  activeStatus   = document.getElementById('inv-filter-status').value;
  currentInvPage = 1;
  renderInventory();
}

async function loadUsersDropdown() {
  const res = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();

  const names = users.map(u => u.name);

  makeSearchable("inv-f-performed", "inv-f-list", names);
  makeSearchable("wd-by", "wd-list", names);
  makeSearchable("po-f-performed", "po-list", names);
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

  // ✅ Add Item / Edit form select — value must be location_id (FK)
  const formSelects = [
    document.getElementById("inv-f-loc"),
  ];

  formSelects.forEach(select => {
    if (!select) return;

    select.innerHTML = "";

    locations.forEach(loc => {
      const opt = document.createElement("option");
      opt.value = loc.location_id;       // ✅ SAVE ID
      opt.textContent = loc.location_name;
      select.appendChild(opt);
    });
  });

  // ✅ Table filter select — value must be location_name (matches item.location_name from /api/inventory)
  const filterSelect = document.getElementById("inv-filter-location");
  if (filterSelect) {
    const previousValue = filterSelect.value || 'all';

    filterSelect.innerHTML = '<option value="all">Location: All</option>';

    locations.forEach(loc => {
      const opt = document.createElement("option");
      opt.value = loc.location_name;
      opt.textContent = loc.location_name;
      filterSelect.appendChild(opt);
    });

    // ✅ restore previous selection if it still exists in the list
    const stillExists = Array.from(filterSelect.options).some(o => o.value === previousValue);
    filterSelect.value = stillExists ? previousValue : 'all';
  }
}

// ── Search Listener ──
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("inventory-search");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    currentInvPage = 1;
    renderInventory();
  });
});

// ── Populate Location filter on load ──
document.addEventListener("DOMContentLoaded", () => {
  loadLocationDropdown();
});