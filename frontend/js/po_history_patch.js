/* ============================================================
   po_history_patch.js — Main History for Purchase Orders
   ============================================================
   Adds "View Item History" to the Order DP. Load AFTER orders.js,
   main.js, and item_history_panel.js.
   ============================================================ */

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

  html += `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${isAdmin && canReceive ? `<button class="btn btn-green btn-sm" onclick="event.stopPropagation(); openReceive(${o.purchase_order_id})">📦 Receive Items</button>` : ''}
        ${isAdmin && canCancel ? `<button class="btn btn-red btn-sm" onclick="event.stopPropagation(); cancelOrder(${o.purchase_order_id})">❌ Cancel Order</button>` : ''}
        ${itemHistoryButton('po', o.purchase_order_id, o.item_name || `PO`)}
      </div>
    </div>
  `;

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

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.order = dpOrder;
