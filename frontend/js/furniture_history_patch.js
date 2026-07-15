/* ============================================================
   furniture_history_patch.js — Main History for Office Furniture
   ============================================================
   Adds "View Item History" to the Furniture DP and sends
   user_id/performed_by on save so backend attribution isn't null.
   Load AFTER main.js and item_history_panel.js.
   ============================================================ */

function saveFurniture() {
  const name      = document.getElementById('fur-f-name').value.trim();
  const qty       = document.getElementById('fur-f-qty').value;
  const date      = document.getElementById('fur-f-date').value;
  const price     = document.getElementById('fur-f-price').value;
  const loc       = document.getElementById('fur-f-loc').value;
  const remarks   = document.getElementById('fur-f-remarks').value;
  const condition = document.getElementById('fur-f-condition').value;

  if (!name || !qty || !loc) {
    showToast('Fill required fields', 't-error');
    return;
  }

  const url    = furEditId ? `${API_URL}/api/furniture/${furEditId}` : `${API_URL}/api/furniture`;
  const method = furEditId ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      furniture_name: name,
      quantity: qty,
      date_of_purchase: date,
      price,
      remarks,
      current_location: loc,
      condition,
      user_id: currentUser.user_id,
      performed_by: currentUser.name,
    })
  })
  .then(res => { if (!res.ok) throw new Error('Failed'); })
  .then(() => {
    showToast(furEditId ? 'Furniture updated' : 'Furniture added', 't-success');
    addLog(furEditId ? 'UPDATE' : 'CREATE', 'FURNITURE',
      `${furEditId ? 'Updated' : 'Added'} furniture: ${name}`, name);
    furEditId = null;
    closeM('m-add-fur');
    renderFurniture();
    if (dpOpen && dpCurrentType === 'furniture') dpFurniture(dpCurrentId);
  })
  .catch(() => showToast('Error saving furniture', 't-error'));
}

async function dpFurniture(id) {
  const f = _allFurniture.find(x => x.office_furniture_id === id);
  if (!f) return;

  const condCls = {
    New:        'b-blue',
    Good:       'b-green',
    Fair:       'b-amber',
    'For Repair': 'b-red'
  }[f.condition] || 'b-slate';

  setDPHeader('🪑', '#fffbeb', f.furniture_name, 'Office Furniture');

  document.getElementById('dp-body').innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">📦 Asset Information</div>
      <div class="dp-grid">
        ${dpFieldFull('Asset Name', `<strong>${f.furniture_name}</strong>`)}
        ${dpField('Quantity', f.quantity)}
        ${dpField('Date Purchased', f.date_of_purchase ? new Date(f.date_of_purchase).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—')}
        ${dpField('Price / Unit', f.price ? '₱' + Number(f.price).toLocaleString() : '—')}
        ${dpField('Total Value', f.price && f.quantity ? '₱' + (Number(f.price) * f.quantity).toLocaleString() : '—')}
        ${dpField('Location', f.location_name || '—')}
        ${dpField('Condition', f.condition ? `<span class="badge ${condCls}">${f.condition}</span>` : '—')}
      </div>
    </div>

    ${f.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', f.remarks)}</div></div>` : ''}

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${isAdminUser() ? `
          <button class="btn btn-primary btn-sm" onclick="editFur(${f.office_furniture_id})">✏️ Edit</button>
          <button class="btn btn-red btn-sm" onclick="deleteFur(${f.office_furniture_id}, '${f.furniture_name.replace(/'/g,"\\'")}')">🗑️ Delete</button>
        ` : ''}
        ${itemHistoryButton('furniture', f.office_furniture_id, f.furniture_name)}
      </div>
    </div>
  `;

  document.getElementById('dp-footer').style.display = 'none';
}

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.furniture = dpFurniture;
