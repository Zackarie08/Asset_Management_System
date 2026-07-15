// frontend/js/orders.js — FIXED VERSION
// Changes:
//   • Proper status computation: ORDERED / PARTIAL / DELIVERED / CANCELLED
//   • Actions (Receive, Cancel) hidden when CANCELLED or DELIVERED
//   • dpOrder shows correct status badge per state

// ── Filter/pagination state ──
let poSearchQuery  = '';
let poFilterStatus = 'all';
let currentPOPage  = 1;
const poPerPage    = 20;
let _allOrders     = [];

/* ── STATUS HELPERS ─────────────────────────────────────── */

/**
 * Compute the effective display status of a PO.
 * Precedence: CANCELLED > DELIVERED > PARTIAL > DELAYED > ORDERED
 */
function computePOStatus(o) {
  if (o.status === 'CANCELLED') return 'CANCELLED';

  const received  = o.received_quantity || 0;
  const ordered   = o.quantity_ordered  || 0;
  const remaining = ordered - received;

  if (remaining <= 0 && ordered > 0)  return 'DELIVERED';
  if (received > 0 && remaining > 0)  return 'PARTIAL';

  // Check if delayed
  if (o.expected_delivery_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eta = new Date(o.expected_delivery_date);
    eta.setHours(0, 0, 0, 0);
    if (eta < today) return 'DELAYED';
  }

  return 'ORDERED';
}

function poStatusBadgeClass(status) {
  const map = {
    ORDERED:   'b-blue',
    PARTIAL:   'b-amber',
    DELIVERED: 'b-green',
    CANCELLED: 'b-slate',
    DELAYED:   'b-red',
  };
  return map[status] || 'b-slate';
}

/* ── FILTER / PAGINATION ─────────────────────────────────── */
function applyPOFilters() {
  poFilterStatus = document.getElementById('po-filter-status').value;
  currentPOPage  = 1;
  _renderPOTable();
}

function _filterOrders(data) {
  return data.filter(o => {

    // Search — item name
    if (poSearchQuery) {
      const haystack = `${o.item_name || ''}`.toLowerCase();
      if (!haystack.includes(poSearchQuery)) return false;
    }

    // Status filter (computed status, so DELAYED works correctly)
    if (poFilterStatus !== 'all') {
      const status = computePOStatus(o);
      if (status !== poFilterStatus) return false;
    }

    return true;
  });
}

// ✅ CHANGED: now delegates to the shared sliding-window pagination helper
function _renderPOPagination(total) {
  renderPaginationControls('po-pagination-container', total, poPerPage, currentPOPage, (newPage) => {
    currentPOPage = newPage;
    _renderPOTable();
  });
}

/* ── RENDER TABLE ───────────────────────────────────────── */
function _renderPOTable() {
  const filtered  = _filterOrders(_allOrders);
  const total     = filtered.length;
  const start     = (currentPOPage - 1) * poPerPage;
  const paginated = filtered.slice(start, start + poPerPage);

  const tbody = document.getElementById('po-tbody');
  tbody.innerHTML = '';

  let delayedCount = 0;
  let activeCount  = 0;
  _allOrders.forEach(o => {
    const status = computePOStatus(o);
    if (status === 'DELAYED') delayedCount++;
    if (status !== 'DELIVERED' && status !== 'CANCELLED') activeCount++;
  });

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--slate-400)">No orders found.</td></tr>`;
  } else {
    paginated.forEach(o => {
      const status   = computePOStatus(o);
      const badgeCls = poStatusBadgeClass(status);

      const tr = document.createElement('tr');
      tr.className = `tr-clickable${status === 'CANCELLED' ? '' : status === 'DELAYED' ? ' tr-warn' : ''}`;

      tr.innerHTML = `
        <td>${o.purchase_order_id}</td>
        <td>${o.item_name || '—'}</td>
        <td>${o.quantity_ordered}</td>
        <td>${formatDateHuman(o.order_date)}</td>
        <td>${formatDateHuman(o.expected_delivery_date)}</td>
        <td><span class="badge ${badgeCls}">${status}</span></td>
      `;

      tr.addEventListener('click', () => openDP('order', o.purchase_order_id, tr));
      tbody.appendChild(tr);
    });
  }

  const totalEl   = document.getElementById('po-total-ct');
  const delayedEl = document.getElementById('po-delay-ct');
  const activeEl  = document.getElementById('po-active-ct');
  if (totalEl)   totalEl.textContent   = `${total} orders`;
  if (delayedEl) delayedEl.textContent = `${delayedCount} delayed`;
  if (activeEl)  activeEl.textContent  = `${activeCount} active`;

  _renderPOPagination(total);
}

async function renderOrders() {
  const res   = await fetch(`${API_URL}/api/po`);
  _allOrders  = await res.json();
  currentPOPage = 1;
  _renderPOTable();
}

/* ── DETAIL PANEL ───────────────────────────────────────── */
async function dpOrder(id) {
  const res  = await fetch(`${API_URL}/api/po`);
  const data = await res.json();

  const o = data.find(x => x.purchase_order_id === id);
  if (!o) return;

  const status    = computePOStatus(o);
  const received  = o.received_quantity || 0;
  const remaining = o.quantity_ordered - received;
  const badgeCls  = poStatusBadgeClass(status);

  setDPHeader(
    '🛒', '#eff6ff',
    o.item_name || `PO #${o.purchase_order_id}`,
    `PO #${o.purchase_order_id}`
  );

  // ✅ FIX: Only show actions when order is active (not cancelled/delivered)
  const canReceive = remaining > 0 && status !== 'CANCELLED';
  const canCancel  = status !== 'CANCELLED' && status !== 'DELIVERED';
  const isAdmin    = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  let html = `
    <div class="dp-section">
      <div class="dp-status-row">
        <span class="badge ${badgeCls}">${status}</span>
        <span class="dp-status-label">Order status</span>
      </div>
      <div class="dp-section-hd">📦 Order Information</div>
      <div class="dp-grid">
        ${dpField('Item Name',      o.item_name || '—')}
        ${dpField('Ordered',        `${o.quantity_ordered} ${o.unit || ''}`)}
        ${dpField('Received',       received)}
        ${dpField('Remaining',      remaining > 0 ? remaining : 0)}
        ${dpField('Supplier',       o.supplier_name || '—')}
        ${dpField('Contact',        o.supplier_contact || '—')}
        ${dpField('Unit Price',     o.unit_price ? '₱' + o.unit_price : '—')}
        ${dpField('Order Date',     formatDateHuman(o.order_date))}
        ${dpField('Expected',       formatDateHuman(o.expected_delivery_date))}
        ${dpField('Delivered',      o.actual_delivery_date ? formatDateHuman(o.actual_delivery_date) : 'Pending')}
        ${o.remarks ? dpFieldFull('Remarks', o.remarks) : ''}
      </div>
    </div>
  `;

  // ✅ FIX: Actions only shown when allowed
  if (isAdmin && (canReceive || canCancel)) {
    html += `
      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
          ${canReceive ? `
            <button class="btn btn-green btn-sm"
              onclick="event.stopPropagation(); openReceive(${o.purchase_order_id})">
              📦 Receive Items
            </button>
          ` : ''}
          ${canCancel ? `
            <button class="btn btn-red btn-sm"
              onclick="event.stopPropagation(); cancelOrder(${o.purchase_order_id})">
              ❌ Cancel Order
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Show cancelled notice
  if (status === 'CANCELLED') {
    html += `
      <div class="dp-alert danger">
        ❌ <span class="dp-alert-text">This order has been cancelled. No further actions available.</span>
      </div>
    `;
  }

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

/* ── SAVE PO ────────────────────────────────────────────── */
function savePO() {
  const qty   = parseInt(document.getElementById("po-f-qty").value) || 1;
  const unit  = document.getElementById("po-f-unit").value;
  const date  = document.getElementById("po-f-date").value;
  const eta   = document.getElementById("po-f-eta").value;
  const notes = document.getElementById("po-f-notes").value;

  if (!selectState["po-f-performed"]) {
    showToast("Select a valid user", "t-error");
    return;
  }

  fetch(`${API_URL}/api/po`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id:              currentOrderItemId,
      quantity:             qty,
      order_date:           date,
      expected_delivery_date: eta,
      remarks:              notes,
      unit,
      supplier_name:    document.getElementById("po-supplier").value,
      supplier_contact: document.getElementById("po-contact").value,
      unit_price:       document.getElementById("po-price").value,
      user_id:          currentUser.user_id,
      performed_by:     document.getElementById("po-f-performed").value
    })
  })
  .then(() => {
    showToast("Purchase order created", "t-success");
    closeM("m-add-po");
    renderOrders();
    renderInventory();
  });
}

/* ── CANCEL ORDER ───────────────────────────────────────── */
function cancelOrder(id) {
  if (!confirm('Cancel this order? This cannot be undone.')) return;

  fetch(`${API_URL}/api/po/cancel/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id:      currentUser.user_id,
      performed_by: currentUser.name,
      role:         currentUser.role
    })
  })
  .then(res => {
    if (!res.ok) return res.text().then(t => { throw new Error(t); });
    showToast("Order cancelled", "t-warning");
    addLog("UPDATE", "ORDER", `Cancelled PO #${id}`, id);
    renderOrders();
    renderInventory();
    if (dpOpen && dpCurrentType === 'order') dpOrder(id);
  })
  .catch(err => showToast(err.message || "Cancel failed", "t-error"));
}

/* ── RECEIVE ────────────────────────────────────────────── */
let currentRemaining = 0;
let currentPO = null;

window.openReceive = async function(id) {
  const res  = await fetch(`${API_URL}/api/po`);
  const data = await res.json();
  const o    = data.find(x => x.purchase_order_id === id);
  if (!o) return;

  // Block if cancelled
  if (computePOStatus(o) === 'CANCELLED') {
    showToast('Cannot receive on a cancelled order', 't-error');
    return;
  }

  currentPO        = id;
  currentRemaining = o.quantity_ordered - (o.received_quantity || 0);

  document.getElementById('recv-item-name').textContent = o.item_name || `Item #${o.item_id}`;
  document.getElementById('recv-remaining').textContent = `Remaining: ${currentRemaining}`;
  document.getElementById('recv-qty').value  = '';
  document.getElementById('recv-by').value   = '';
  selectState["recv-by"] = false;

  openM("m-po-receive");
  loadUsersDropdown();
};

async function submitReceive() {
  const qty          = parseInt(document.getElementById("recv-qty").value);
  const performed_by = document.getElementById("recv-by").value;

  if (!qty || qty <= 0)    { showToast("Enter valid quantity", "t-error"); return; }
  if (qty > currentRemaining) { showToast("Cannot exceed remaining qty", "t-error"); return; }
  if (!selectState["recv-by"]) { showToast("Select valid user", "t-error"); return; }

  const res = await fetch(`${API_URL}/api/po/receive/${currentPO}`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ received_qty: qty, performed_by, user_id: currentUser.user_id })
  });

  if (!res.ok) {
    const text = await res.text();
    showToast(text || "Receive failed", "t-error");
    return;
  }

  closeM("m-po-receive");
  showToast("Items received", "t-success");
  addLog("UPDATE", "ORDER", `Received ${qty} items on PO #${currentPO}`, currentPO);
  renderOrders();
  renderInventory();
  if (dpOpen && dpCurrentType === 'order') dpOrder(currentPO);
}

/* ── MARK DELIVERED (legacy) ───────────────────────────── */
function markDelivered(id) {
  fetch(`${API_URL}/api/po/deliver/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id:      currentUser.user_id,
      performed_by: currentUser.name,
      role:         currentUser.role
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("Delivery failed");
    showToast("Delivery confirmed", "t-success");
    addLog("UPDATE", "ORDER", `Marked PO #${id} as delivered`, id);
    renderOrders();
    renderInventory();
    closeDP();
  })
  .catch(err => showToast("Error confirming delivery", "t-error"));
}
