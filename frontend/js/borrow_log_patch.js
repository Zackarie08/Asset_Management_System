/* ============================================================
   borrow_log_patch.js — Part 2
   ============================================================
   ROOT CAUSE: addLog(action, module, desc, ref) (main.js) never sent a
   performed_by value to POST /api/logs at all — every System Log call
   site had to bake attribution INTO the description string instead
   (e.g. "Borrowed Banner — by Sean"), because there was no other way
   to get a name into the "Performed By" column.

   FIX:
     • addLog() gains a 5th optional param, performedBy. When omitted
       it sends null (identical behavior to before — no regression for
       any of the many existing addLog() call sites across the app).
     • confirmBorrowItem() / confirmReturnItem() (Event Supplies + IT
       Supplies borrow/return, from inventory_borrow_wine_patch.js) now
       pass the borrower/returner name as performedBy and drop the
       "— by X" suffix from the description, so System Logs shows it
       in the correct column.

   This ONLY changes System Logs. The separate Global Item History
   system (item_history table / "View Item History" panel) already
   stores performed_by_name correctly via logItemHistory() in
   backend/routes/borrowReturn.js and is untouched here.

   Load AFTER inventory_borrow_wine_patch.js (and after
   itsupplies_borrow_patch.js, though only inventory_borrow_wine_patch.js
   actually defines these functions — itsupplies reuses them).
   ============================================================ */

function addLog(action, module, desc, ref = '—', performedBy = null) {
  if (!currentUser) return;

  fetch(`${API_URL}/api/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: currentUser.user_id,
      action_type: action,
      module: module,
      description: desc,
      reference_type: ref,
      performed_by: performedBy // ✅ NEW (Part 2) — null unless explicitly passed
    })
  }).catch(err => console.error("Log error:", err));
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
