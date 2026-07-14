/* ============================================================
   item_history_panel.js — Part 8 (Global Item History, frontend)
   ============================================================
   ONE reusable modal + fetch/render logic used by every module.
   Each module's DP renderer just adds a button:

       ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}

   and this file handles the rest (fetch, render, modal open/close).
   Requires: openM()/closeM() (utils.js), API_URL (config.js),
   the #m-item-history modal markup (see index_html_patch.md).

   Load this AFTER utils.js and BEFORE any module patch file that
   calls itemHistoryButton() inside a dp*() renderer.
   ============================================================ */

const ITEM_HISTORY_ACTION_META = {
  CREATED:                { icon: '✅', label: 'Created' },
  EDITED:                 { icon: '✏️', label: 'Edited' },
  STATUS_CHANGED:         { icon: '🔄', label: 'Status Changed' },
  ASSIGNED:               { icon: '👤', label: 'Assigned' },
  UNASSIGNED:             { icon: '↩️', label: 'Unassigned' },
  BORROWED:               { icon: '📤', label: 'Borrowed' },
  RETURNED:               { icon: '📥', label: 'Returned' },
  REQUESTED:              { icon: '📩', label: 'Requested' },
  APPROVED:               { icon: '✅', label: 'Approved' },
  DENIED:                 { icon: '❌', label: 'Denied' },
  CANCELLED:              { icon: '🚫', label: 'Cancelled' },
  RENEWED:                { icon: '🔁', label: 'Renewed' },
  MAINTENANCE_PERFORMED:  { icon: '🔧', label: 'Maintenance Performed' },
  QUANTITY_ADJUSTED:      { icon: '📊', label: 'Quantity Adjusted' },
  COVERAGE_CHANGED:       { icon: '🛡️', label: 'Coverage Changed' },
  ATTACHMENT_ADDED:       { icon: '📎', label: 'Attachment Added' },
  ATTACHMENT_REMOVED:     { icon: '📎', label: 'Attachment Removed' },
  LOCATION_MOVED:         { icon: '📦', label: 'Location Moved' },
  DELETED:                { icon: '🗑️', label: 'Deleted' },
};

async function openItemHistory(module, recordId, label = '') {
  const labelEl = document.getElementById('ih-title-label');
  if (labelEl) labelEl.textContent = label ? `— ${label}` : '';

  const body = document.getElementById('ih-body');
  if (body) body.innerHTML = `<div style="text-align:center;padding:24px;color:var(--slate-400);font-size:12.5px">Loading history…</div>`;

  openM('m-item-history');

  try {
    const res  = await fetch(`${API_URL}/api/item-history/${module}/${recordId}`);
    const rows = await res.json();
    _renderItemHistory(rows);
  } catch (err) {
    console.error('openItemHistory error:', err);
    if (body) body.innerHTML = `<div style="text-align:center;padding:24px;color:var(--red-500);font-size:12.5px">Failed to load history.</div>`;
  }
}

function _renderItemHistory(rows) {
  const body = document.getElementById('ih-body');
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--slate-400);font-size:12.5px">No history recorded yet for this item.</div>`;
    return;
  }

  body.innerHTML = `<ul class="mh-list">${rows.map(r => {
    const meta = ITEM_HISTORY_ACTION_META[r.action] || { icon: '•', label: r.action };
    const isNegative = ['DENIED', 'CANCELLED', 'DELETED', 'ATTACHMENT_REMOVED'].includes(r.action);
    const dotCls = isNegative ? 'repair' : 'good';

    let changeLine = '';
    if (r.field_name) {
      changeLine = `<div class="mh-remarks"><strong>${_ihEsc(r.field_name)}:</strong> ${_ihEsc(r.old_value) || '—'} → ${_ihEsc(r.new_value) || '—'}</div>`;
    } else if (r.old_value || r.new_value) {
      changeLine = `<div class="mh-remarks">${_ihEsc(r.old_value)} ${r.old_value && r.new_value ? '→' : ''} ${_ihEsc(r.new_value)}</div>`;
    }

    // ✅ IMMUTABILITY FIX (see Global_Item_History_Immutability_Review.md):
    // performed_by_name is a permanent snapshot captured when the row was
    // written. Never fall back to a live-joined "current" name here — a
    // user rename/deletion must NOT change what past history displays.
    const who = r.performed_by_name || 'System';

    return `
      <li class="mh-item">
        <div class="mh-dot ${dotCls}"></div>
        <div style="flex:1">
          <div class="mh-cond info">${meta.icon} ${meta.label}</div>
          <div class="mh-date">${new Date(r.created_at).toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })} · ${_ihEsc(who)}</div>
          ${changeLine}
          ${r.remarks ? `<div class="mh-remarks">📝 ${_ihEsc(r.remarks)}</div>` : ''}
        </div>
      </li>`;
  }).join('')}</ul>`;
}

function _ihEsc(str) {
  if (str === null || str === undefined || str === '') return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Drop this into any dp*() renderer's Actions section:
 *   ${itemHistoryButton('inventory', item.inventory_gen_id, item.item_name)}
 */
function itemHistoryButton(module, recordId, label = '') {
  const safeLabel = String(label || '').replace(/'/g, "\\'");
  return `<button class="btn btn-outline btn-sm" onclick="openItemHistory('${module}',${recordId},'${safeLabel}')">🕒 View Item History</button>`;
}