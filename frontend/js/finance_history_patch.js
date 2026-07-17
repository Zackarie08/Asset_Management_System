/* ============================================================
   finance_history_patch.js — Part 7
   ============================================================
   Replaces the one-click toggleFinanceLocation() with a confirm
   flow requiring Performed By + Remarks (backend now enforces this
   too — see backend/routes/finance.js PUT /:id/move).

   Load AFTER main.js and item_history_panel.js.
   Requires the new #m-fin-move modal markup — see
   Financial_Document_Movement_History.md for the index.html patch.
   ============================================================ */

let _finMoveId = null;
let _finMoveCurrentLoc = null;
let _finMoveLabel = null;

// ✅ REPLACES the old one-click version in main.js — now opens a modal
// instead of PUTting immediately.
function toggleFinanceLocation(id) {
  fetch(`${API_URL}/api/finance-documents/${id}`)
    .then(r => r.json())
    .then(f => {
      if (!f) return;
      _finMoveId = id;
      _finMoveCurrentLoc = f.location;
      _finMoveLabel = `${f.category} · Folder #${f.folder_number}`; // business folder label, not a DB id
      const nextLoc = f.location === 'STORAGE' ? 'OFFICE' : 'STORAGE';

      document.getElementById('fin-move-summary').innerHTML =
        `Moving <strong>${_esc(f.category)}</strong> (Folder #${_esc(f.folder_number)})<br/>
         <span class="badge ${f.location === 'STORAGE' ? 'b-green' : 'b-blue'}">${f.location}</span>
         → <span class="badge ${nextLoc === 'STORAGE' ? 'b-green' : 'b-blue'}">${nextLoc}</span>`;

      document.getElementById('fin-move-by').value = '';
      selectState['fin-move-by'] = false;
      document.getElementById('fin-move-remarks').value = '';

      openM('m-fin-move');
      _loadFinMoveUsers();
    });
}

async function _loadFinMoveUsers() {
  const res = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();
  makeSearchable('fin-move-by', 'fin-move-by-list', users.map(u => u.name));
}

function confirmFinanceMove() {
  const performed_by = document.getElementById('fin-move-by').value.trim();
  const remarks       = document.getElementById('fin-move-remarks').value.trim();

  if (!selectState['fin-move-by'] || !performed_by) {
    showToast('Select a valid user for Performed By', 't-error');
    return;
  }
  if (!remarks) {
    showToast('Remarks are required to move a document', 't-error');
    return;
  }

  fetch(`${API_URL}/api/finance-documents/${_finMoveId}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ performed_by, remarks, user_id: currentUser.user_id }),
  })
    .then(res => {
      if (!res.ok) return res.json().catch(() => ({})).then(e => { throw new Error(e.error || 'Move failed'); });
      return res.json();
    })
    .then(data => {
      showToast(`Moved to ${data.location}`, 't-success');
      addLog('UPDATE', 'FINANCE', `Moved ${_finMoveLabel} to ${data.location} — ${remarks}`, _finMoveId);
      closeM('m-fin-move');
      renderFinance();
      if (dpOpen && dpCurrentType === 'finance' && dpCurrentId === _finMoveId) dpFinance(_finMoveId);
    })
    .catch(err => showToast(err.message || 'Error moving document', 't-error'));
}

/* ── DP: swap the inline 🔄 button for the gated flow + add History ── */
async function dpFinance(id) {
  const res = await fetch(`${API_URL}/api/finance-documents`);
  const data = await res.json();

  const f = data.find(x => x.finance_id === id);
  if (!f) return;

  setDPHeader('📁', '#eff6ff', f.category, "Folder #" + f.folder_number);

  const start = String(f.range_start).padStart(4,'0');
  const end   = String(f.range_end).padStart(4,'0');
  const range = `${f.category_code}${f.year}${start} - ${f.category_code}${f.year}${end}`;

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">📋 Details</div>
      <div class="dp-grid">
        ${dpField("Year", f.year)}
        ${dpField("Folder #", f.folder_number)}
        ${dpField("Category", f.category)}
        ${dpField("Code", f.category_code)}
        ${dpField("Range", range)}
        ${dpField(
          "Location",
          `<span class="badge ${f.location === 'STORAGE' ? 'b-green' : 'b-blue'}">${f.location}</span>
          <button class="btn btn-xs btn-outline"
            onclick="event.stopPropagation(); toggleFinanceLocation(${f.finance_id})">
            🔄 Move
          </button>`
        )}
      </div>
    </div>

    ${f.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', f.remarks)}</div></div>` : ''}

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm" onclick="editFinance(${f.finance_id})">✏️ Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteFinance(${f.finance_id})">🗑️ Delete</button>
        ${itemHistoryButton('finance', f.finance_id, `${f.category} · Folder #${f.folder_number}`)}
      </div>
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.finance = dpFinance;

/* ============================================================
   finance_move_log_patch.js
   ============================================================
   Fixes: moving a finance document between STORAGE/OFFICE wrote
   performed_by correctly into Item History (backend already
   receives it — see finance.js PUT /:id/move), but the matching
   System Log entry never passed performed_by as addLog()'s 5th
   argument, so the System Logs table's "Performed by" column was
   always blank for this action.

   Also expands the log description to match the richer style
   used elsewhere in the app (item identity + direction + remarks),
   instead of the previous minimal "Moved to Office" text.

   Load AFTER finance_history_patch.js (overrides confirmFinanceMove
   only — toggleFinanceLocation/dpFinance are untouched and still
   come from finance_history_patch.js).
   ============================================================ */

function confirmFinanceMove() {
  const performed_by = document.getElementById('fin-move-by').value.trim();
  const remarks       = document.getElementById('fin-move-remarks').value.trim();

  if (!selectState['fin-move-by'] || !performed_by) {
    showToast('Select a valid user for Performed By', 't-error');
    return;
  }
  if (!remarks) {
    showToast('Remarks are required to move a document', 't-error');
    return;
  }

  fetch(`${API_URL}/api/finance-documents/${_finMoveId}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ performed_by, remarks, user_id: currentUser.user_id }),
  })
    .then(res => {
      if (!res.ok) return res.json().catch(() => ({})).then(e => { throw new Error(e.error || 'Move failed'); });
      return res.json();
    })
    .then(data => {
      showToast(`Moved to ${data.location}`, 't-success');

      // ✅ FIX: richer description (matches the style used by other
      // modules) + performed_by now passed as the 5th addLog() argument
      // so the System Logs "Performed by" column is populated.
      const fromLocation = data.location === 'STORAGE' ? 'OFFICE' : 'STORAGE';
      const description =
        `Financial Document moved from ${fromLocation} to ${data.location}\n` +
        `Document: ${_finMoveLabel}\n` +
        `Remarks: ${remarks}`;

      addLog('UPDATE', 'FINANCE', description, _finMoveId, performed_by);

      closeM('m-fin-move');
      renderFinance();
      if (dpOpen && dpCurrentType === 'finance' && dpCurrentId === _finMoveId) dpFinance(_finMoveId);
    })
    .catch(err => showToast(err.message || 'Error moving document', 't-error'));
}