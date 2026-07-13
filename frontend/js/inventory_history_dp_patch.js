/* ============================================================
   inventory_history_dp_patch.js — Part 8 reference wiring
   ============================================================
   Adds "🕒 View Item History" to Inventory's detail panel Actions
   row, without touching the ~150-line dpInventory() in main.js
   wholesale (per the project's patch-file-over-full-rewrite rule).

   Load AFTER main.js and AFTER item_history_panel.js.

   NOTE (reference-capture gotcha): DP_RENDERERS.inventory was
   captured as a direct function reference when main.js first
   loaded. Redeclaring dpInventory here does NOT change what
   DP_RENDERERS.inventory points to — it must be re-pointed
   explicitly at the bottom of this file (same pattern already
   used for laptop/insurance).
   ============================================================ */

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

        <!-- ✅ NEW (Part 8) -->
        ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}

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
  } else {
    // ✅ NEW: non-admins can still view history, just not mutate
    html += `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}
      </div>
    </div>`;
  }

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

// Re-point the captured reference — see header note.
if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.inventory = dpInventory;
