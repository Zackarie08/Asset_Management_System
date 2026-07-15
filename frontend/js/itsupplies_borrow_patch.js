/* ============================================================
   itsupplies_borrow_patch.js — Part 3
   ============================================================
   Same Borrow/Return system as Event Supplies (Part 2), applied to
   IT Supplies. Reuses the generic backend/routes/borrowReturn.js
   (module='itsupplies') and the SAME modals (#m-borrow-item /
   #m-return-item) — no new backend or modal markup needed.

   Load AFTER main.js, item_history_panel.js, and
   inventory_borrow_wine_patch.js (for openBorrowItem/openReturnItem/
   confirmBorrowItem/confirmReturnItem, all reused as-is).
   ============================================================ */

async function dpITSupplies(id) {
  const it = _allITSupplies.find(x => x.it_supplies_id === id);
  if (!it) return;

  const statusCls = {
    Available: 'b-green',
    'In Use':  'b-blue',
    Damaged:   'b-red'
  }[it.status] || 'b-slate';

  setDPHeader('🖨️', '#eef2ff', it.asset_name, 'IT Supply');

  let openBorrows = [];
  try {
    const res = await fetch(`${API_URL}/api/borrow-return/itsupplies/${id}`);
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
          ${b.status === 'BORROWED' ? `<button class="btn btn-xs btn-green" onclick="openReturnItem(${b.borrow_id}, '${it.asset_name.replace(/'/g,"\\'")}')">✅ Mark Returned</button>` : ''}
        </li>`).join('')}
    </ul>` : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No borrow history yet.</div>`;

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  document.getElementById('dp-body').innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">💻 Asset Details</div>
      <div class="dp-grid">
        ${dpFieldFull('Asset Name', `<strong>${it.asset_name}</strong>`)}
        ${dpField('Serial / Model', it.serial_number || '—', 'mono')}
        ${dpField('Quantity', it.quantity)}
        ${dpField('Date Purchased', it.date_of_purchase ? new Date(it.date_of_purchase).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—')}
        ${dpField('Price', it.price ? '₱' + Number(it.price).toLocaleString() : '—')}
        ${dpField('Location', it.location_name || '—')}
        ${dpField('Status', it.status ? `<span class="badge ${statusCls}">${it.status}</span>` : '—')}
        ${dpField('Warranty', _warrantyBadge(it.warranty_end_date))}
        ${dpField('Warranty Expiry', it.warranty_end_date ? new Date(it.warranty_end_date).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—', 'mono')}
      </div>
    </div>

    ${it.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', it.remarks)}</div></div>` : ''}

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${isAdmin ? `<button class="btn btn-amber btn-sm" onclick="openBorrowItem(${it.it_supplies_id},'${it.asset_name.replace(/'/g,"\\'")}','itsupplies',${it.quantity})">📤 Borrow</button>` : ''}
        ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="editIT(${it.it_supplies_id})">✏️ Edit</button>` : ''}
        ${itemHistoryButton('itsupplies', it.it_supplies_id, it.asset_name)}
        ${isAdmin ? `<button class="btn btn-red btn-sm" onclick="deleteIT(${it.it_supplies_id}, '${it.asset_name.replace(/'/g,"\\'")}')">🗑️ Delete</button>` : ''}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📤 Borrow / Return ${currentlyOut.length ? `<span class="badge b-amber" style="margin-left:6px">${currentlyOut.length} out</span>` : ''}</div>
      ${listHTML}
    </div>
  `;

  document.getElementById('dp-footer').style.display = 'none';
}

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.itsupplies = dpITSupplies;