/* ============================================================
   wine_stock_validation_patch.js — Part 1
   ============================================================
   ROOT CAUSE: submitWineRequest() (inventory_borrow_wine_patch.js)
   only checked that quantity > 0 — never against actual stock. A
   user could request more bottles than existed (e.g. request 7 when
   only 3 were in stock). _buildWineActionsHTML() also passed the
   item's RAW current_quantity into openWineRequest() as "available",
   ignoring quantity already tied up in other PENDING requests.

   FIX (frontend half — the backend half lives in
   backend/routes/wineRequests.js POST /, which is the check that
   actually can't be bypassed):
     • _buildWineActionsHTML now computes trueAvailable = stock minus
       pending-request quantities and passes THAT into the button.
     • openWineRequest() sets a max on the quantity input and stores
       the available amount.
     • submitWineRequest() rejects locally before ever hitting the
       network if quantity > available.

   Load AFTER inventory_borrow_wine_patch.js.
   ============================================================ */

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
              <button class="btn btn-xs btn-green" onclick="approveWineRequest(${r.request_id}, '${_escInv(item.item_name)}')">✅</button>
              <button class="btn btn-xs btn-red" onclick="denyWineRequest(${r.request_id}, '${_escInv(item.item_name)}')">❌</button>
            </div>` : ''}
          ${!isAdmin && r.status === 'PENDING' && r.requested_by_id === currentUser.user_id ? `
            <button class="btn btn-xs btn-outline" onclick="cancelWineRequest(${r.request_id}, '${_escInv(item.item_name)}')">Cancel</button>` : ''}
        </li>`;
      }).join('')}
    </ul>` : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No withdrawal requests yet.</div>`;

  let actionButtons = '';
  if (!isAdmin) {
    actionButtons = myPending
      ? `<span class="td-muted" style="font-size:12px">⏳ Your request for ${myPending.quantity} unit(s) is pending approval</span>`
      : `<button class="btn btn-primary btn-sm" onclick="openWineRequest(${item.inventory_gen_id},'${_escInv(item.item_name)}',${trueAvailable})">🍷 Request Withdrawal</button>`;
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
