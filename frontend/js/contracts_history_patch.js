/* ============================================================
   contracts_history_patch.js — Part 5
   ============================================================
   Fixes "request status disappears after actions occur" and adds the
   full request timeline the spec asks for.

   ROOT CAUSE (backend): DELETE /request/:id used to hard-delete the row on
   cancel, so a cancelled request vanished instead of ever showing "Cancelled"
   anywhere. Fixed server-side in contracts.js (soft-cancel). This file is
   the matching frontend piece: it now renders EVERY request for a contract
   (not just the latest) as a timeline, and always shows a status pill even
   when there's no PENDING/APPROVED request active.

   Load AFTER main.js and AFTER item_history_panel.js.
   ============================================================ */

const CONTRACT_REQ_STATUS_META = {
  PENDING:   { icon: '⏳', label: 'Pending',   cls: 'b-amber' },
  APPROVED:  { icon: '✅', label: 'Approved',  cls: 'b-green' },
  REJECTED:  { icon: '❌', label: 'Denied',    cls: 'b-red'   },
  CANCELLED: { icon: '🚫', label: 'Cancelled', cls: 'b-slate' },
  RETURNED:  { icon: '↩️', label: 'Returned',  cls: 'b-blue'  },
};

// ✅ NEW: request timeline is now collapsible (default collapsed — the
// status pill above already shows the current state at a glance; the
// full timeline is opt-in detail).
let showContractRequestTimeline = false;

function toggleContractRequestTimeline() {
  showContractRequestTimeline = !showContractRequestTimeline;
  if (dpOpen && dpCurrentType === 'contracts') renderContractActions(_currentContract);
}

function _crMeta(status) {
  return CONTRACT_REQ_STATUS_META[status] || { icon: '•', label: status || '—', cls: 'b-slate' };
}

/* ── DP: add "View Item History" alongside the existing content ───── */
async function dpContract(id) {
  const res = await fetch(`${API_URL}/api/contracts/${id}`);
  const c   = await res.json();
  if (!c) return;

  _currentContract = c;

  setDPHeader("📄", "#eef2ff", c.other_party, c.description);

  let validity = '—';
  if (c.validity_type === 'NA') {
    validity = 'No Expiration (NA)';
  } else if (c.validity_type === 'YEAR') {
    validity = c.valid_year || '—';
  } else {
    validity = `${formatDateHuman(c.valid_from)} — ${formatDateHuman(c.valid_to)}`;
  }

  let expiryBadge = "";
  if (c.validity_type === 'NA') {
    expiryBadge = `<span class="badge b-slate">No Expiration</span>`;
  } else {
    const expiryDate = c.validity_type === "YEAR"
      ? new Date(`${c.valid_year}-12-31`)
      : c.valid_to ? new Date(c.valid_to) : null;
    if (expiryDate) {
      const days = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      if (days < 0)       expiryBadge = `<span class="badge b-red">Expired</span>`;
      else if (days <= 30) expiryBadge = `<span class="badge b-amber">Expires in ${days}d</span>`;
      else                 expiryBadge = `<span class="badge b-green">Valid</span>`;
    }
  }

  const statusBadge = _contractStatusLabel(c);

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">📋 Details</div>
      <div class="dp-grid">
        ${dpField("Date",          formatDateHuman(c.contract_date))}
        ${dpField("Other Party",   c.other_party)}
        ${dpField("Description",   c.description)}
        ${dpField("Validity Type", c.validity_type)}
        ${dpField("Validity",      validity)}
        ${dpField("Status",        statusBadge)}
        ${dpField("Expiry Status", expiryBadge)}
      </div>
    </div>

    ${c.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes', c.remarks)}</div></div>` : ''}
    <div id="contract-actions"></div>
    <div class="dp-section">
      <div class="dp-action-row">${itemHistoryButton('contracts', c.contract_id, c.other_party)}</div>
    </div>`;

  document.getElementById("dp-body").innerHTML = html;
  renderContractActions(c);
}

/* ── Actions + ALWAYS-VISIBLE current status + FULL timeline ──────── */
async function renderContractActions(c) {
  const el = document.getElementById("contract-actions");
  if (!el) return;

  const isAdmin      = currentUser.role === "admin" || currentUser.role === "super_admin";
  const isSuperAdmin = currentUser.role === "super_admin";

  let buttons = "";
  let statusPillHTML = "";
  let timelineHTML = "";

  try {
    const res = await fetch(`${API_URL}/api/contracts/requests`);
    const allRequests = await res.json();
    // ✅ FIX: every request for this contract, not just "the latest one" —
    // CANCELLED/REJECTED/RETURNED rows are no longer deleted server-side,
    // so this now genuinely reflects the full history.
    const requests = allRequests
      .filter(r => r.contract_id == c.contract_id)
      .sort((a, b) => new Date(b.request_date) - new Date(a.request_date));

    const latestReq = requests[0];
    const currentReq = requests.find(r => r.status === 'PENDING' || r.status === 'APPROVED');

    // ── Status pill: ALWAYS shown, reflects the true latest state ──
    if (latestReq) {
      const meta = _crMeta(latestReq.status);
      statusPillHTML = `
        <div class="dp-status-row">
          <span class="badge ${meta.cls}">${meta.icon} ${meta.label}</span>
          <span class="dp-status-label">Current request status · ${_esc(latestReq.requested_name)}</span>
        </div>`;
    } else {
      statusPillHTML = `
        <div class="dp-status-row">
          <span class="badge b-slate">No requests yet</span>
        </div>`;
    }

    // ── Full timeline — every request cycle, oldest action last ──
    if (requests.length) {
      timelineHTML = `
        <div class="dp-section-hd" style="margin-top:12px;cursor:pointer" onclick="toggleContractRequestTimeline()">
          📜 Request Timeline (${requests.length}) ${showContractRequestTimeline ? '▲ Hide' : '▼ Show'}
        </div>
        ${showContractRequestTimeline ? `
        <ul class="mh-list">
          ${requests.map(r => {
            const meta = _crMeta(r.status);
            const dateLabel = r.status === 'APPROVED' && r.approved_date
              ? formatDateHuman(r.approved_date)
              : formatDateHuman(r.request_date);
            const who = r.status === 'APPROVED' ? (r.approved_by_name || '—')
                      : r.status === 'REJECTED' ? (r.denied_by_name || '—')
                      : r.requested_name || '—';
            return `
              <li class="mh-item">
                <div class="mh-dot ${r.status === 'APPROVED' ? 'good' : r.status === 'REJECTED' ? 'repair' : 'good'}"></div>
                <div>
                  <div class="mh-cond info">${meta.icon} ${meta.label} — ${_esc(who)}</div>
                  <div class="mh-date">${dateLabel}</div>
                  <div class="mh-remarks">Requested by ${_esc(r.requested_name)}</div>
                </div>
              </li>`;
          }).join('')}
        </ul>` : ''}`;
    }

    // ── Action buttons (same logic as before, unaffected by the fix) ──
    if (!isAdmin) {
      if (!currentReq) {
        buttons = `<button class="btn btn-primary btn-sm" onclick="requestContract(${c.contract_id})">📩 Request Contract</button>`;
      } else if (currentReq.requested_by !== currentUser.user_id) {
        buttons = `<button class="btn btn-outline btn-sm" disabled>🔒 Requested by ${_esc(currentReq.requested_name)}</button>`;
      } else if (currentReq.status === "PENDING") {
        buttons = `<button class="btn btn-red btn-sm" onclick="cancelRequest(${currentReq.request_id})">❌ Cancel Request</button>`;
      } else if (currentReq.status === "APPROVED") {
        buttons = `<span class="td-muted" style="font-size:12px">✅ You currently hold this contract</span>`;
      }
    }

    if (isAdmin) {
      if (currentReq && currentReq.status === "PENDING") {
        buttons = isSuperAdmin
          ? `<button class="btn btn-green btn-sm" onclick="approveRequest(${currentReq.request_id})">Approve</button>
             <button class="btn btn-red btn-sm" onclick="denyRequest(${currentReq.request_id})">Deny</button>`
          : `<span class="td-muted" style="font-size:12px">⏳ Pending — only a Super Admin can approve/deny</span>`;
      }
      if (c.status === "WITH_EMPLOYEE" && currentReq) {
        buttons += `<button class="btn btn-outline btn-sm" onclick="returnContract(${currentReq.request_id})">Mark as Returned</button>`;
      }
      buttons += `
        <button class="btn btn-primary btn-sm" onclick="editContract(${c.contract_id})">✏️ Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteContract(${c.contract_id})">🗑️ Delete</button>`;
    }

  } catch (err) {
    console.error(err);
    buttons = "<span class='dp-muted'>Error loading actions</span>";
  }

  el.innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      ${statusPillHTML}
      <div class="dp-action-row" style="margin-bottom:10px;">
        ${buttons || "<span class='dp-muted'>No actions available</span>"}
      </div>
      ${timelineHTML}
    </div>`;
}