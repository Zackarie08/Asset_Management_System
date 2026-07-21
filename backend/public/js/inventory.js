

// helper (utils.js) instead of rendering every page number individually.
function renderPagination(totalItems) {
  renderPaginationControls('pagination-container', totalItems, itemsPerPage, currentInvPage, (newPage) => {
    currentInvPage = newPage;
    renderInventory();
  });
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
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const isLow = item.current_quantity <= item.reorder_level;
  setDPHeader('box', '#eff6ff', item.item_name, item.category);

  const maxCapacity = Math.max(item.reorder_level * 5, 1);
  const progress = Math.min(100, Math.round((item.current_quantity / maxCapacity) * 100));
  const barColor = isLow ? '#ff4d4f' : '#52c41a';

  let html = `
    ${isLow ? `<div class="dp-alert warning"><i data-lucide="triangle-alert"></i> <span class="dp-alert-text">Stock is below reorder level. Create a purchase order.</span></div>` : ''}
    <div class="prog-bar-wrap">
      <div class="prog-bar-labels"><span>Stock Level</span><span>${item.current_quantity} / ${item.reorder_level*5} ${item.unit}</span></div>
      <div class="prog-bar-track"><div class="prog-bar-fill" style="width:${progress}%;background:${barColor}"></div></div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="clipboard-list"></i> Item Details</div>
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

    ${item.remarks ? `<div class="dp-section"><div class="dp-section-hd"><i data-lucide="sticky-note"></i> Remarks</div><div class="dp-grid">${dpFieldFull('Notes', item.remarks)}</div></div>` : ''}`;

  /* ── Category-specific action sets (unchanged from inventory_borrow_wine_patch.js) ── */
  if (item.category === 'Company Event Supplies') {
    html += await _buildEventSupplyActionsHTML(item, isAdmin);
  } else if (item.category === 'Wine') {
    html += await _buildWineActionsHTML(item, isAdmin);
  } else if (isAdmin) {
    html += `
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-warning btn-sm" onclick="openWithdraw(${item.inventory_gen_id})"><i data-lucide="minus"></i> Withdraw</button>
        <button class="btn btn-primary btn-sm" onclick="openCreateOrder(${item.inventory_gen_id})"><i data-lucide="package-plus"></i> Create Order</button>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openEditInv(${item.inventory_gen_id})"><i data-lucide="pencil"></i> Edit</button>
        ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}
        <button class="btn btn-red btn-sm" onclick="event.stopPropagation(); deleteInventory(${item.inventory_gen_id}, '${item.item_name.replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i> Delete</button>
      </div>
    </div>`;
  } else {
    html += `
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
      <div class="dp-action-row">${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}</div>
    </div>`;
  }

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';

  if (window.lucide) lucide.createIcons();
}


let currentOrderItemId = null;

window.openCreateOrder = async function(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();

  const item = items.find(i => i.inventory_gen_id === id);
  if (!item) return;

  currentOrderItemId = id;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('po-f-item', item.item_name);
  setVal('po-f-cat', item.category);
  setVal('po-f-unit', item.unit);
  setVal('po-f-price', item.price || '');
  setVal('po-f-date', todayStr());

  openM('m-add-po');
  loadUsersDropdown();
};

window.openEditInv = async function(id) {
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();
  const item = items.find(i => i.inventory_gen_id === id);
  if (!item) return;

  invEditId = id;
  closeDP();

  document.getElementById('m-add-inv-title').innerHTML = `<i data-lucide="pencil"></i> Edit Inventory Item`;
  if (window.lucide) lucide.createIcons();
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
  makeSearchable("recv-by", "recv-list", names);
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

const EVENT_SUPPLIES_CATEGORY = 'Company Event Supplies';
const WINE_CATEGORY = 'Wine';

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.inventory = dpInventory;

async function renderInventory() {
  const res = await fetch(`${API_URL}/api/inventory`);
  const allItems = await res.json();

  // ✅ NEW: pending-request signals for the visual indicator badges
  const [wineReqs, invBorrows] = await Promise.all([
    safeFetch(`${API_URL}/api/wine-requests`),
    safeFetch(`${API_URL}/api/borrow-return/open/inventory`),
  ]);
  const wineItemIds = new Set(wineReqs.map(r => r.inventory_gen_id));
  const borrowedIds = new Set(invBorrows.filter(b => b.status === 'BORROWED').map(b => b.record_id));

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

    let requestBadge = '';
    if (wineItemIds.has(item.inventory_gen_id)) {
      requestBadge = '<span class="badge b-amber" style="margin-left:4px"><i data-lucide="wine"></i> Pending Request</span>';
    } else if (borrowedIds.has(item.inventory_gen_id)) {
      requestBadge = '<span class="badge b-blue" style="margin-left:4px"><i data-lucide="package-minus"></i> Borrowed</span>';
    }

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
        ${requestBadge}
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("inv-low-ct").innerText = low + " low stock";
  document.getElementById("inv-total-ct").innerText = totalItems + " items";

  renderPagination(totalItems);

  if (window.lucide) lucide.createIcons();
}

let _wineReqAvailable = 0;

async function _buildWineActionsHTML(item, isAdmin) {
  let requests = [];
  try {
    const res = await fetch(`${API_URL}/api/wine-requests/${item.inventory_gen_id}`);
    requests = await res.json();
  } catch { /* ignore */ }

  const myPending  = requests.find(r => r.status === 'PENDING' && r.requested_by_id === currentUser.user_id);
  const anyPending = requests.filter(r => r.status === 'PENDING');

  // ✅ FIX (Part 1): available = actual stock minus whatever is already
  // tied up in other pending requests, not just raw current_quantity.
  const pendingQty     = anyPending.reduce((s, r) => s + (r.quantity || 0), 0);
  const trueAvailable  = Math.max(item.current_quantity - pendingQty, 0);

  const timelineHTML = requests.length ? `
    <ul class="mh-list">
      ${requests.map(r => {
        const meta = {
          PENDING:   ['<i data-lucide="clock"></i> Pending', 'good'],
          APPROVED:  ['<i data-lucide="check"></i> Approved', 'good'],
          DENIED:    ['<i data-lucide="x"></i> Denied', 'repair'],
          CANCELLED: ['<i data-lucide="x-circle"></i> Cancelled', 'repair'],
        }[r.status] || [r.status, 'good'];
        const who = r.status === 'APPROVED' ? r.approved_by_name : r.status === 'DENIED' ? r.denied_by_name : r.requested_name;
        return `
        <li class="mh-item">
          <div class="mh-dot ${meta[1]}"></div>
          <div>
            <div class="mh-cond info">${meta[0]} — ${r.quantity} unit(s)</div>
            <div class="mh-date">${formatDateHuman(r.request_date)} · Requested by ${r.requested_name}${who && who !== r.requested_name ? ` · by ${who}` : ''}</div>
            ${r.remarks ? `<div class="mh-remarks"><i data-lucide="sticky-note"></i> ${r.remarks}</div>` : ''}
          </div>
          ${isAdmin && r.status === 'PENDING' ? `
            <div style="display:flex;gap:4px">
              <button class="btn btn-xs btn-green" onclick="approveWineRequest(${r.request_id}, '${_escInv(item.item_name)}')"><i data-lucide="check"></i></button>
              <button class="btn btn-xs btn-red" onclick="denyWineRequest(${r.request_id}, '${_escInv(item.item_name)}')"><i data-lucide="x"></i></button>
            </div>` : ''}
          ${!isAdmin && r.status === 'PENDING' && r.requested_by_id === currentUser.user_id ? `
            <button class="btn btn-xs btn-outline" onclick="cancelWineRequest(${r.request_id}, '${_escInv(item.item_name)}')">Cancel</button>` : ''}
        </li>`;
      }).join('')}
    </ul>` : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No withdrawal requests yet.</div>`;

  let actionButtons = '';
  if (!isAdmin) {
    actionButtons = myPending
      ? `<span class="td-muted" style="font-size:12px"><i data-lucide="clock"></i> Your request for ${myPending.quantity} unit(s) is pending approval</span>`
      : `<button class="btn btn-primary btn-sm" onclick="openWineRequest(${item.inventory_gen_id},'${_escInv(item.item_name)}',${trueAvailable})"><i data-lucide="wine"></i> Request Withdrawal</button>`;
  } else {
    actionButtons = `
      <button class="btn btn-warning btn-sm" onclick="openWithdraw(${item.inventory_gen_id})"><i data-lucide="minus"></i> Withdraw</button>
      <button class="btn btn-primary btn-sm" onclick="openCreateOrder(${item.inventory_gen_id})"><i data-lucide="package-plus"></i> Create Order</button>
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openEditInv(${item.inventory_gen_id})"><i data-lucide="pencil"></i> Edit</button>
      <button class="btn btn-red btn-sm" onclick="event.stopPropagation(); deleteInventory(${item.inventory_gen_id}, '${_escInv(item.item_name)}')"><i data-lucide="trash-2"></i> Delete</button>`;
  }

  return `
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
      <div class="dp-action-row">
        ${actionButtons}
        ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}
      </div>
    </div>
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="wine"></i> Withdrawal Requests ${anyPending.length ? `<span class="badge b-amber" style="margin-left:6px">${anyPending.length} pending</span>` : ''}</div>
      ${timelineHTML}
    </div>`;
}


function openWineRequest(itemId, itemName, available) {
  _wineReqAvailable = available; // ✅ NEW (Part 1)
  document.getElementById('wine-req-item-name').textContent = itemName;
  document.getElementById('wine-req-available').textContent = `Available: ${available}`;
  document.getElementById('wine-req-qty').value = '';
  document.getElementById('wine-req-qty').max = available; // ✅ NEW — hard cap on the input itself
  document.getElementById('wine-req-remarks').value = '';
  document.getElementById('wine-req-item-id').value = itemId;
  document.getElementById('wine-req-item-id').dataset.name = itemName;
  openM('m-wine-request');
}

function submitWineRequest() {
  const idEl = document.getElementById('wine-req-item-id');
  const inventory_gen_id = parseInt(idEl.value);
  const itemName = idEl.dataset.name || 'item';
  const quantity = parseInt(document.getElementById('wine-req-qty').value);
  const remarks  = document.getElementById('wine-req-remarks').value;

  if (!quantity || quantity <= 0) { showToast('Enter a valid quantity', 't-error'); return; }

  // ✅ FIX (Part 1): reject locally before hitting the network. The
  // authoritative check still lives server-side (POST /api/wine-requests),
  // so this can never be bypassed by editing the DOM/input.
  if (quantity > _wineReqAvailable) {
    showToast(`Cannot request more than available stock (${_wineReqAvailable} available)`, 't-error');
    return;
  }

  fetch(`${API_URL}/api/wine-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventory_gen_id, quantity, remarks, user_id: currentUser.user_id }),
  })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); return res.json(); })
    .then(() => {
      showToast('Withdrawal request submitted', 't-success');
      addLog('REQUEST', 'INVENTORY', `Requested wine withdrawal of ${quantity} unit(s) — ${itemName}`, inventory_gen_id);
      closeM('m-wine-request');
      if (dpOpen && dpCurrentId === inventory_gen_id) dpInventory(inventory_gen_id);
    })
    .catch(err => showToast(err.message || 'Failed to submit request', 't-error'));
}

function confirmBorrowItem() {
  const quantity = parseInt(document.getElementById('borrow-qty').value);
  const borrowed_by = document.getElementById('borrow-by').value.trim();
  const borrow_date = document.getElementById('borrow-date').value;
  const remarks = document.getElementById('borrow-remarks').value;

  if (!quantity || quantity <= 0) { showToast('Enter a valid quantity', 't-error'); return; }
  if (!selectState['borrow-by'] || !borrowed_by) { showToast('Select a valid borrower', 't-error'); return; }

  fetch(`${API_URL}/api/borrow-return/borrow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module: _borrowItemModule, record_id: _borrowItemId, quantity, borrowed_by, user_id: currentUser.user_id, remarks, borrow_date }),
  })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); return res.json(); })
    .then(() => {
      showToast('Item borrowed', 't-success');
      // ✅ FIX (Part 2): borrower now goes into Performed By, not baked
      // into the Description text.
      addLog(
        'UPDATE',
        _borrowItemModule === 'inventory' ? 'INVENTORY' : 'IT SUPPLY',
        `Borrowed ${quantity} unit(s) of ${_borrowItemName}`,
        _borrowItemId,
        borrowed_by
      );
      closeM('m-borrow-item');
      if (_borrowItemModule === 'inventory') { renderInventory(); if (dpOpen && dpCurrentId === _borrowItemId) dpInventory(_borrowItemId); }
      else { renderITSupplies(); if (dpOpen && dpCurrentId === _borrowItemId) dpITSupplies(_borrowItemId); }
    })
    .catch(err => showToast(err.message || 'Failed to borrow item', 't-error'));
}

function confirmReturnItem() {
  const returned_by = document.getElementById('return-by').value.trim();
  const return_date = document.getElementById('return-date').value;
  const remarks = document.getElementById('return-remarks').value;

  if (!selectState['return-by'] || !returned_by) { showToast('Select a valid user', 't-error'); return; }

  fetch(`${API_URL}/api/borrow-return/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ borrow_id: _returnBorrowId, returned_by, user_id: currentUser.user_id, remarks, return_date }),
  })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); return res.json(); })
    .then(() => {
      showToast('Item returned', 't-success');
      // ✅ FIX (Part 2): returner now goes into Performed By.
      addLog('UPDATE', 'INVENTORY', `Returned ${_returnItemName}`, _returnBorrowId, returned_by);
      closeM('m-return-item');
      if (dpOpen && dpCurrentType === 'inventory') dpInventory(dpCurrentId);
      if (dpOpen && dpCurrentType === 'itsupplies') dpITSupplies(dpCurrentId);
      renderInventory();
      if (typeof renderITSupplies === 'function') renderITSupplies();
    })
    .catch(err => {
      // ✅ Part 3: surfaces the new 403 ("Only Admin or Super Admin can
      // process returns") from the backend permission check instead of a
      // generic failure message.
      showToast(err.message || 'Failed to return item', 't-error');
    });
}



/* ════════════════ EVENT SUPPLIES — BORROW / RETURN ════════════════ */

async function _buildEventSupplyActionsHTML(item, isAdmin) {
  let openBorrows = [];
  try {
    const res = await fetch(`${API_URL}/api/borrow-return/inventory/${item.inventory_gen_id}`);
    openBorrows = await res.json();
  } catch { /* ignore */ }

  const currentlyOut = openBorrows.filter(b => b.status === 'BORROWED');

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
          ${isAdmin && b.status === 'BORROWED' ? `<button class="btn btn-xs btn-green" onclick="openReturnItem(${b.borrow_id}, '${_escInv(item.item_name)}')"><i data-lucide="check"></i> Mark Returned</button>` : ''}
        </li>`).join('')}
    </ul>` : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No borrow history yet.</div>`;

  return `
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
      <div class="dp-action-row">
        ${isAdmin ? `<button class="btn btn-amber btn-sm" onclick="openBorrowItem(${item.inventory_gen_id},'${_escInv(item.item_name)}','inventory',${item.current_quantity})"><i data-lucide="package-minus"></i> Borrow</button>` : ''}
        ${isAdmin ? `<button class="btn btn-warning btn-sm" onclick="openWithdraw(${item.inventory_gen_id})"><i data-lucide="minus"></i> Withdraw (Permanent)</button>` : ''}
        ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="openCreateOrder(${item.inventory_gen_id})"><i data-lucide="package-plus"></i> Create Order</button>` : ''}
        ${isAdmin ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openEditInv(${item.inventory_gen_id})"><i data-lucide="pencil"></i> Edit</button>` : ''}
        ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}
        ${isAdmin ? `<button class="btn btn-red btn-sm" onclick="event.stopPropagation(); deleteInventory(${item.inventory_gen_id}, '${_escInv(item.item_name)}')"><i data-lucide="trash-2"></i> Delete</button>` : ''}
      </div>
    </div>
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="package-minus"></i> Borrow / Return ${currentlyOut.length ? `<span class="badge b-amber" style="margin-left:6px">${currentlyOut.length} out</span>` : ''}</div>
      ${listHTML}
    </div>`;
}

function _escInv(str) {
  return String(str || '').replace(/'/g, "\\'");
}

let _borrowItemId = null;
let _borrowItemModule = null;
let _borrowItemName = null;

function openBorrowItem(recordId, itemName, module, available) {
  _borrowItemId = recordId;
  _borrowItemModule = module;
  _borrowItemName = itemName;
  document.getElementById('borrow-item-name').textContent = itemName;
  document.getElementById('borrow-available').textContent = `Available: ${available}`;
  document.getElementById('borrow-qty').value = '';
  document.getElementById('borrow-date').value = todayStr();
  document.getElementById('borrow-by').value = '';
  selectState['borrow-by'] = false;
  document.getElementById('borrow-remarks').value = '';
  openM('m-borrow-item');
  fetch(`${API_URL}/api/auth/users`).then(r => r.json()).then(users => {
    makeSearchable('borrow-by', 'borrow-by-list', users.map(u => u.name));
  });
}

let _returnBorrowId = null;
let _returnItemName = null;

function openReturnItem(borrowId, itemName) {
  _returnBorrowId = borrowId;
  _returnItemName = itemName || 'item';
  document.getElementById('return-date').value = todayStr();
  document.getElementById('return-by').value = '';
  selectState['return-by'] = false;
  document.getElementById('return-remarks').value = '';
  openM('m-return-item');
  fetch(`${API_URL}/api/auth/users`).then(r => r.json()).then(users => {
    makeSearchable('return-by', 'return-by-list', users.map(u => u.name));
  });
}


/* ════════════════ WINE — REQUEST / APPROVE / DENY ════════════════ */

function approveWineRequest(requestId, itemName) {
  fetch(`${API_URL}/api/wine-requests/${requestId}/approve`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: currentUser.user_id }),
  })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('Request approved', 't-success');
      addLog('REQUEST', 'INVENTORY', `Approved wine withdrawal request — ${itemName || 'item'}`, requestId);
      renderInventory();
      if (dpOpen && dpCurrentType === 'inventory') dpInventory(dpCurrentId);
    })
    .catch(err => showToast(err.message || 'Approve failed', 't-error'));
}

function denyWineRequest(requestId, itemName) {
  fetch(`${API_URL}/api/wine-requests/${requestId}/deny`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: currentUser.user_id }),
  })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('Request denied', 't-warning');
      addLog('REQUEST', 'INVENTORY', `Denied wine withdrawal request — ${itemName || 'item'}`, requestId);
      if (dpOpen && dpCurrentType === 'inventory') dpInventory(dpCurrentId);
    })
    .catch(err => showToast(err.message || 'Deny failed', 't-error'));
}

function cancelWineRequest(requestId, itemName) {
  fetch(`${API_URL}/api/wine-requests/${requestId}`, { method: 'DELETE' })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('Request cancelled', 't-warning');
      addLog('REQUEST', 'INVENTORY', `Cancelled wine withdrawal request — ${itemName || 'item'}`, requestId);
      if (dpOpen && dpCurrentType === 'inventory') dpInventory(dpCurrentId);
    })
    .catch(err => showToast(err.message || 'Cancel failed', 't-error'));
}