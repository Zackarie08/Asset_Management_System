/* ============================================================
   inventory_borrow_wine_patch.js — Parts 2 (Event Supplies + Wine)
   ============================================================
   Consolidates dpInventory() one more time (supersedes the Part 8
   inventory_history_dp_patch.js version — same function, redeclared,
   last-loaded wins per the project's documented pattern) to add:

     - "Company Event Supplies" items: Borrow / Return actions +
       an "Currently Borrowed" list instead of plain Withdraw.
     - "Wine" items: Request Withdrawal (employee) + pending request
       approval UI (admin/super_admin) instead of direct Withdraw.
     - All other categories: unchanged (Withdraw/Order/Edit/Delete).
     - View Item History button retained for every category.

   Load AFTER main.js, item_history_panel.js, and
   inventory_history_dp_patch.js.

   Requires the new modals in Inventory_Borrow_Return_System.md /
   Wine_Request_Approval_Workflow.md.
   ============================================================ */

const EVENT_SUPPLIES_CATEGORY = 'Company Event Supplies';
const WINE_CATEGORY = 'Wine';

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
      </div>
    </div>

    ${item.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', item.remarks)}</div></div>` : ''}`;

  /* ── Category-specific action sets ─────────────────────── */
  if (item.category === EVENT_SUPPLIES_CATEGORY) {
    html += await _buildEventSupplyActionsHTML(item, isAdmin);
  } else if (item.category === WINE_CATEGORY) {
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
            <div class="mh-cond info">${b.status === 'BORROWED' ? '📤 Borrowed' : '📥 Returned'} — ${b.quantity} unit(s)</div>
            <div class="mh-date">${b.borrowed_by_name} · ${formatDateHuman(b.borrow_date)}</div>
            ${b.borrow_remarks ? `<div class="mh-remarks">📝 ${b.borrow_remarks}</div>` : ''}
            ${b.status === 'RETURNED' ? `<div class="mh-remarks">↩️ Returned by ${b.returned_by_name} · ${formatDateHuman(b.return_date)}</div>` : ''}
          </div>
          ${isAdmin && b.status === 'BORROWED' ? `<button class="btn btn-xs btn-green" onclick="openReturnItem(${b.borrow_id})">✅ Mark Returned</button>` : ''}
        </li>`).join('')}
    </ul>` : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No borrow history yet.</div>`;

  return `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${isAdmin ? `<button class="btn btn-amber btn-sm" onclick="openBorrowItem(${item.inventory_gen_id},'${_escInv(item.item_name)}','inventory',${item.current_quantity})">📤 Borrow</button>` : ''}
        ${isAdmin ? `<button class="btn btn-warning btn-sm" onclick="openWithdraw(${item.inventory_gen_id})">➖ Withdraw (Permanent)</button>` : ''}
        ${isAdmin ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openEditInv(${item.inventory_gen_id})">✏️ Edit</button>` : ''}
        ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}
        ${isAdmin ? `<button class="btn btn-red btn-sm" onclick="event.stopPropagation(); deleteInventory(${item.inventory_gen_id}, '${_escInv(item.item_name)}')">🗑️ Delete</button>` : ''}
      </div>
    </div>
    <div class="dp-section">
      <div class="dp-section-hd">📤 Borrow / Return ${currentlyOut.length ? `<span class="badge b-amber" style="margin-left:6px">${currentlyOut.length} out</span>` : ''}</div>
      ${listHTML}
    </div>`;
}

function _escInv(str) {
  return String(str || '').replace(/'/g, "\\'");
}

let _borrowItemId = null;
let _borrowItemModule = null;

function openBorrowItem(recordId, itemName, module, available) {
  _borrowItemId = recordId;
  _borrowItemModule = module;
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
      addLog('UPDATE', _borrowItemModule === 'inventory' ? 'INVENTORY' : 'IT SUPPLY', `Borrowed ${quantity} unit(s) — record #${_borrowItemId} — by ${borrowed_by}`, _borrowItemId);
      closeM('m-borrow-item');
      if (_borrowItemModule === 'inventory') { renderInventory(); if (dpOpen && dpCurrentId === _borrowItemId) dpInventory(_borrowItemId); }
      else { renderITSupplies(); if (dpOpen && dpCurrentId === _borrowItemId) dpITSupplies(_borrowItemId); }
    })
    .catch(err => showToast(err.message || 'Failed to borrow item', 't-error'));
}

let _returnBorrowId = null;

function openReturnItem(borrowId) {
  _returnBorrowId = borrowId;
  document.getElementById('return-date').value = todayStr();
  document.getElementById('return-by').value = '';
  selectState['return-by'] = false;
  document.getElementById('return-remarks').value = '';
  openM('m-return-item');
  fetch(`${API_URL}/api/auth/users`).then(r => r.json()).then(users => {
    makeSearchable('return-by', 'return-by-list', users.map(u => u.name));
  });
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
      addLog('UPDATE', 'INVENTORY', `Returned borrow #${_returnBorrowId} — by ${returned_by}`, _returnBorrowId);
      closeM('m-return-item');
      if (dpOpen && dpCurrentType === 'inventory') dpInventory(dpCurrentId);
      if (dpOpen && dpCurrentType === 'itsupplies') dpITSupplies(dpCurrentId);
      renderInventory();
      if (typeof renderITSupplies === 'function') renderITSupplies();
    })
    .catch(err => showToast(err.message || 'Failed to return item', 't-error'));
}

/* ════════════════ WINE — REQUEST / APPROVE / DENY ════════════════ */

async function _buildWineActionsHTML(item, isAdmin) {
  let requests = [];
  try {
    const res = await fetch(`${API_URL}/api/wine-requests/${item.inventory_gen_id}`);
    requests = await res.json();
  } catch { /* ignore */ }

  const myPending = requests.find(r => r.status === 'PENDING' && r.requested_by_id === currentUser.user_id);
  const anyPending = requests.filter(r => r.status === 'PENDING');

  const timelineHTML = requests.length ? `
    <ul class="mh-list">
      ${requests.map(r => {
        const meta = { PENDING: ['⏳ Pending', 'good'], APPROVED: ['✅ Approved', 'good'], DENIED: ['❌ Denied', 'repair'], CANCELLED: ['🚫 Cancelled', 'repair'] }[r.status] || [r.status, 'good'];
        const who = r.status === 'APPROVED' ? r.approved_by_name : r.status === 'DENIED' ? r.denied_by_name : r.requested_name;
        return `
        <li class="mh-item">
          <div class="mh-dot ${meta[1]}"></div>
          <div>
            <div class="mh-cond info">${meta[0]} — ${r.quantity} unit(s)</div>
            <div class="mh-date">${formatDateHuman(r.request_date)} · Requested by ${r.requested_name}${who && who !== r.requested_name ? ` · by ${who}` : ''}</div>
            ${r.remarks ? `<div class="mh-remarks">📝 ${r.remarks}</div>` : ''}
          </div>
          ${isAdmin && r.status === 'PENDING' ? `
            <div style="display:flex;gap:4px">
              <button class="btn btn-xs btn-green" onclick="approveWineRequest(${r.request_id})">✅</button>
              <button class="btn btn-xs btn-red" onclick="denyWineRequest(${r.request_id})">❌</button>
            </div>` : ''}
          ${!isAdmin && r.status === 'PENDING' && r.requested_by_id === currentUser.user_id ? `
            <button class="btn btn-xs btn-outline" onclick="cancelWineRequest(${r.request_id})">Cancel</button>` : ''}
        </li>`;
      }).join('')}
    </ul>` : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No withdrawal requests yet.</div>`;

  let actionButtons = '';
  if (!isAdmin) {
    actionButtons = myPending
      ? `<span class="td-muted" style="font-size:12px">⏳ Your request for ${myPending.quantity} unit(s) is pending approval</span>`
      : `<button class="btn btn-primary btn-sm" onclick="openWineRequest(${item.inventory_gen_id},'${_escInv(item.item_name)}',${item.current_quantity})">🍷 Request Withdrawal</button>`;
  } else {
    actionButtons = `
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openEditInv(${item.inventory_gen_id})">✏️ Edit</button>
      <button class="btn btn-red btn-sm" onclick="event.stopPropagation(); deleteInventory(${item.inventory_gen_id}, '${_escInv(item.item_name)}')">🗑️ Delete</button>`;
  }

  return `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${actionButtons}
        ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}
      </div>
    </div>
    <div class="dp-section">
      <div class="dp-section-hd">🍷 Withdrawal Requests ${anyPending.length ? `<span class="badge b-amber" style="margin-left:6px">${anyPending.length} pending</span>` : ''}</div>
      ${timelineHTML}
    </div>`;
}

function openWineRequest(itemId, itemName, available) {
  document.getElementById('wine-req-item-name').textContent = itemName;
  document.getElementById('wine-req-available').textContent = `Available: ${available}`;
  document.getElementById('wine-req-qty').value = '';
  document.getElementById('wine-req-remarks').value = '';
  document.getElementById('wine-req-item-id').value = itemId;
  openM('m-wine-request');
}

function submitWineRequest() {
  const inventory_gen_id = parseInt(document.getElementById('wine-req-item-id').value);
  const quantity = parseInt(document.getElementById('wine-req-qty').value);
  const remarks  = document.getElementById('wine-req-remarks').value;

  if (!quantity || quantity <= 0) { showToast('Enter a valid quantity', 't-error'); return; }

  fetch(`${API_URL}/api/wine-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventory_gen_id, quantity, remarks, user_id: currentUser.user_id }),
  })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); return res.json(); })
    .then(() => {
      showToast('Withdrawal request submitted', 't-success');
      addLog('REQUEST', 'INVENTORY', `Requested wine withdrawal — item #${inventory_gen_id} — qty ${quantity}`, inventory_gen_id);
      closeM('m-wine-request');
      if (dpOpen && dpCurrentId === inventory_gen_id) dpInventory(inventory_gen_id);
    })
    .catch(err => showToast(err.message || 'Failed to submit request', 't-error'));
}

function approveWineRequest(requestId) {
  fetch(`${API_URL}/api/wine-requests/${requestId}/approve`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: currentUser.user_id }),
  })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('Request approved', 't-success');
      addLog('REQUEST', 'INVENTORY', `Approved wine withdrawal request #${requestId}`, requestId);
      renderInventory();
      if (dpOpen && dpCurrentType === 'inventory') dpInventory(dpCurrentId);
    })
    .catch(err => showToast(err.message || 'Approve failed', 't-error'));
}

function denyWineRequest(requestId) {
  fetch(`${API_URL}/api/wine-requests/${requestId}/deny`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: currentUser.user_id }),
  })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('Request denied', 't-warning');
      addLog('REQUEST', 'INVENTORY', `Denied wine withdrawal request #${requestId}`, requestId);
      if (dpOpen && dpCurrentType === 'inventory') dpInventory(dpCurrentId);
    })
    .catch(err => showToast(err.message || 'Deny failed', 't-error'));
}

function cancelWineRequest(requestId) {
  fetch(`${API_URL}/api/wine-requests/${requestId}`, { method: 'DELETE' })
    .then(res => { if (!res.ok) return res.json().then(e => { throw new Error(e.error); }); })
    .then(() => {
      showToast('Request cancelled', 't-warning');
      addLog('REQUEST', 'INVENTORY', `Cancelled wine withdrawal request #${requestId}`, requestId);
      if (dpOpen && dpCurrentType === 'inventory') dpInventory(dpCurrentId);
    })
    .catch(err => showToast(err.message || 'Cancel failed', 't-error'));
}
