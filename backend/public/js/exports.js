/* ============================================================
   exports.js — CSV EXPORT AUDIT PASS
   ============================================================
   ROOT CAUSE (see CSV_Export_Audit_Report.md for full detail):
   index.html wires up onclick="exportOrders()", exportFurniture(),
   exportITSupplies(), exportLaptops(), exportContracts(),
   exportInsurance(), exportFinance(), and exportUsers() — but
   none of these functions were ever defined anywhere in the
   codebase. Clicking those buttons threw a silent
   "exportX is not a function" error in the console and did
   nothing visible to the user ("do nothing" symptom).

   vehicles_enhanced.js::exportVehicles(), inventory.js::
   exportInventory(), subscriptions_unified.js::
   exportUnifiedSubscriptions(), and main.js::exportLogs() were
   already implemented correctly and are used as the reference
   pattern here (BOM + comma-joined CSV + Blob download).

   This file is additive only — it does not modify any existing
   working export. Load it AFTER inventory.js / main.js /
   vehicles_enhanced.js / subscriptions_unified.js / users.js in
   index.html:

       <script src="js/exports.js"></script>

   Every export below:
     • Uses the SAME filtered dataset the table is currently
       showing (via the module's existing cache + filter helpers)
       where available, so "Export" matches what's on screen —
       exactly like exportInventory() already does.
     • Falls back to a fresh fetch when a module has no client-side
       cache (Orders, Insurance).
     • Uses meaningful column headers.
     • Writes an Excel-compatible CSV (UTF-8 BOM + comma-separated,
       quoted text fields).
   ============================================================ */

/* ── Shared CSV writer (used by every export below) ─────────── */
function _downloadCsv(headers, rows, filenamePrefix) {
  if (!rows.length) {
    showToast('No data to export', 't-error');
    return false;
  }
  const csv  = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported successfully', 't-success');
  return true;
}

function _csvStr(val) {
  return `"${String(val ?? '—').replace(/"/g, '""')}"`;
}

/* ── PURCHASE ORDERS ─────────────────────────────────────────
   No client cache exists in orders.js, so we fetch fresh and
   reuse the same status computation the table uses
   (computePOStatus, defined in orders.js) for consistency. */
async function exportOrders() {
  try {
    const res  = await fetch(`${API_URL}/api/po`);
    const data = await res.json();

    const headers = ['PO #', 'Item Name', 'Qty Ordered', 'Received', 'Remaining',
      'Supplier', 'Order Date', 'Expected Delivery', 'Status'];

    const rows = data.map(o => {
      const status    = (typeof computePOStatus === 'function') ? computePOStatus(o) : (o.status || '—');
      const received  = o.received_quantity || 0;
      const remaining = Math.max((o.quantity_ordered || 0) - received, 0);
      return [
        o.purchase_order_id,
        _csvStr(o.item_name),
        o.quantity_ordered,
        received,
        remaining,
        _csvStr(o.supplier_name),
        _csvStr(o.order_date),
        _csvStr(o.expected_delivery_date),
        _csvStr(status)
      ];
    });

    _downloadCsv(headers, rows, 'PurchaseOrders');
  } catch (err) {
    console.error('exportOrders:', err);
    showToast('Failed to export purchase orders', 't-error');
  }
}

/* ── OFFICE FURNITURE ─────────────────────────────────────────
   Uses _allFurniture + _filterFurniture (main.js) so export
   matches the currently filtered/searched table view. */
async function exportFurniture() {
  try {
    const source = (typeof _allFurniture !== 'undefined' && _allFurniture.length)
      ? _filterFurniture(_allFurniture)
      : await (await fetch(`${API_URL}/api/furniture`)).json();

    const headers = ['Asset Name', 'Quantity', 'Date Purchased', 'Price', 'Supplier', 'Supplier Contact', 'Location', 'Remarks'];
    const rows = source.map(f => [
      _csvStr(f.furniture_name),
      f.quantity,
      _csvStr(f.date_of_purchase),
      f.price ?? '',
      _csvStr(f.supplier),
      _csvStr(f.supplier_contact),
      _csvStr(f.location_name),
      _csvStr(f.remarks)
    ]);

    _downloadCsv(headers, rows, 'Furniture');
  } catch (err) {
    console.error('exportFurniture:', err);
    showToast('Failed to export furniture', 't-error');
  }
}

/* ── IT SUPPLIES ─────────────────────────────────────────────
   Uses _allITSupplies + _filterIT (main.js). */
async function exportITSupplies() {
  try {
    const source = (typeof _allITSupplies !== 'undefined' && _allITSupplies.length)
      ? _filterIT(_allITSupplies)
      : await (await fetch(`${API_URL}/api/it-supplies`)).json();

    const headers = ['Asset Name', 'Serial / Model', 'Quantity', 'Unit', 'Date Purchased',
      'Price', 'Supplier', 'Supplier Contact', 'Warranty End', 'Location', 'Status', 'Remarks'];
    const rows = source.map(it => [
      _csvStr(it.asset_name),
      _csvStr(it.serial_number),
      it.quantity,
      _csvStr(it.unit),
      _csvStr(it.date_of_purchase),
      it.price ?? '',
      _csvStr(it.supplier),
      _csvStr(it.supplier_contact),
      _csvStr(it.warranty_end_date),
      _csvStr(it.location_name),
      _csvStr(it.status),
      _csvStr(it.remarks)
    ]);

    _downloadCsv(headers, rows, 'ITSupplies');
  } catch (err) {
    console.error('exportITSupplies:', err);
    showToast('Failed to export IT supplies', 't-error');
  }
}
/* ── LAPTOPS ─────────────────────────────────────────────────
   Uses _allLaptops + _filterLaptops (main.js). Includes the new
   Remarks + Supplier columns (Part 3) and the resolved employee
   name (lp.user_name) instead of a raw user_id. */
async function exportLaptops() {
  try {
    const source = (typeof _allLaptops !== 'undefined' && _allLaptops.length)
      ? _filterLaptops(_allLaptops)
      : await (await fetch(`${API_URL}/api/laptops`)).json();

    const headers = ['Asset Number', 'Serial Number', 'Description', 'Brand/Category',
      'Supplier', 'Assigned To', 'Status', 'Warranty End', 'Date Purchased', 'Price', 'Remarks'];
    const rows = source.map(lp => [
      _csvStr(lp.asset_number),
      _csvStr(lp.serial_number),
      _csvStr(lp.item_description),
      _csvStr(lp.category),
      _csvStr(lp.supplier),
      _csvStr(lp.user_name || 'Unassigned'),
      _csvStr(lp.status),
      _csvStr(lp.warranty_end_date),
      _csvStr(lp.date_of_purchase),
      lp.price ?? '',
      _csvStr(lp.remarks)
    ]);

    _downloadCsv(headers, rows, 'Laptops');
  } catch (err) {
    console.error('exportLaptops:', err);
    showToast('Failed to export laptops', 't-error');
  }
}

/* ── CONTRACTS ───────────────────────────────────────────────
   Uses _allContracts + _filterContracts (main.js) and the same
   _computeContractExpiry/_contractStatusLabel helpers the table
   uses, so exported status matches what's on screen. */
async function exportContracts() {
  try {
    const source = (typeof _allContracts !== 'undefined' && _allContracts.length)
      ? _filterContracts(_allContracts)
      : await (await fetch(`${API_URL}/api/contracts`)).json();

    const headers = ['Date', 'Other Party', 'Description', 'Validity Type', 'Validity', 'Status', 'Expiry Status', 'Remarks'];
    const rows = source.map(c => {
      let validity = '—';
      if (c.validity_type === 'NA') validity = 'No Expiration';
      else if (c.validity_type === 'YEAR') validity = c.valid_year || '—';
      else validity = `${c.valid_from || '—'} to ${c.valid_to || '—'}`;

      const expiry = (typeof _computeContractExpiry === 'function')
        ? _computeContractExpiry(c).status
        : '—';

      return [
        _csvStr(c.contract_date),
        _csvStr(c.other_party),
        _csvStr(c.description),
        _csvStr(c.validity_type),
        _csvStr(validity),
        _csvStr(c.status),
        _csvStr(expiry),
        _csvStr(c.remarks)
      ];
    });

    _downloadCsv(headers, rows, 'Contracts');
  } catch (err) {
    console.error('exportContracts:', err);
    showToast('Failed to export contracts', 't-error');
  }
}

/* ── INSURANCE ───────────────────────────────────────────────
   insurance.js has no client-side cache, so fetch the list fresh,
   then the assigned-employee names come pre-joined from
   GET /api/insurance/:id if needed — but the list endpoint
   already returns enough for a solid export without N+1 calls. */
async function exportInsurance() {
  try {
    const res  = await fetch(`${API_URL}/api/insurance`);
    const data = await res.json();

    const headers = ['Policy / Plan Name', 'Provider', 'Policy Number', 'Start Date',
      'Expiry Date', 'Coverage Type', 'Remarks'];
    const rows = data.map(ins => [
      _csvStr(ins.employee_name),
      _csvStr(ins.provider),
      _csvStr(ins.policy_number),
      _csvStr(ins.start_date),
      _csvStr(ins.expiry_date),
      _csvStr(ins.coverage_type),
      _csvStr(ins.remarks)
    ]);

    _downloadCsv(headers, rows, 'Insurance');
  } catch (err) {
    console.error('exportInsurance:', err);
    showToast('Failed to export insurance records', 't-error');
  }
}

/* ── FINANCE DOCUMENTS ───────────────────────────────────────
   Uses _allFinance + _filterFinance + _finRangeStr (main.js). */
async function exportFinance() {
  try {
    const source = (typeof _allFinance !== 'undefined' && _allFinance.length)
      ? _filterFinance(_allFinance)
      : await (await fetch(`${API_URL}/api/finance-documents`)).json();

    const headers = ['Year', 'Folder #', 'Category', 'Range', 'Location', 'Remarks'];
    const rows = source.map(f => [
      f.year,
      f.folder_number,
      _csvStr(f.category),
      _csvStr(typeof _finRangeStr === 'function' ? _finRangeStr(f) : `${f.range_start}-${f.range_end}`),
      _csvStr(f.location),
      _csvStr(f.remarks)
    ]);

    _downloadCsv(headers, rows, 'FinanceDocuments');
  } catch (err) {
    console.error('exportFinance:', err);
    showToast('Failed to export finance documents', 't-error');
  }
}

/* ── USERS ───────────────────────────────────────────────────
   Uses _allUsers + _filterUsers (users.js). */
async function exportUsers() {
  try {
    const source = (typeof _allUsers !== 'undefined' && _allUsers.length)
      ? _filterUsers(_allUsers)
      : await (await fetch(`${API_URL}/api/auth/users`)).json();

    const headers = ['Name', 'Email', 'Department', 'Role'];
    const rows = source.map(u => [
      _csvStr(u.name),
      _csvStr(u.email),
      _csvStr(u.department),
      _csvStr(u.role)
    ]);

    _downloadCsv(headers, rows, 'Users');
  } catch (err) {
    console.error('exportUsers:', err);
    showToast('Failed to export users', 't-error');
  }
}
