
/* ──────────────────────────────────────────────────────────────
   SYSTEM LOGS
────────────────────────────────────────────────────────────── */
let logs = [];
let logId = 1;
let logSearchQuery   = '';
let logFilterAction  = 'all';
let logFilterModule  = 'all';
let logFilterDate    = 'all';
let logDateFrom      = '';
let logDateTo        = '';
let currentLogPage   = 1;

const logsPerPage    = 20;
const LOG_ICONS = { LOGIN:'🔐',LOGOUT:'🚪',CREATE:'✅',UPDATE:'✏️',DELETE:'🗑️',DELIVER:'📦',WITHDRAW:'➖',SYSTEM:'⚙️' };

function applyLogFilters() {
  logFilterAction = document.getElementById('log-filter-action').value;
  logFilterModule = document.getElementById('log-filter-module').value;
  logFilterDate   = document.getElementById('log-filter-date').value;
  logDateFrom     = document.getElementById('log-date-from')?.value || '';
  logDateTo       = document.getElementById('log-date-to')?.value   || '';
  currentLogPage  = 1;

  // Show/hide custom range inputs
  const customRange = document.getElementById('log-custom-range');
  if (customRange) {
    customRange.style.display = logFilterDate === 'custom' ? 'flex' : 'none';
  }

  renderLogs();
}

function _filterLogs(logs) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return logs.filter(log => {

    // Search — user name + description
    // ✅ NEW: description included so searching by keyword (e.g. item name,
    // "withdrew", a specific PO #) surfaces relevant log entries
    if (logSearchQuery) {
      const haystack = `${log.name || ''} ${log.description || ''}`.toLowerCase();
      if (!haystack.includes(logSearchQuery)) return false;
    }

    // Action filter
    if (logFilterAction !== 'all' && log.action_type !== logFilterAction) return false;

    // Module filter
    if (logFilterModule !== 'all' && log.module !== logFilterModule) return false;

    // Date filter
    if (logFilterDate !== 'all') {
      const logDate = new Date(log.date_time);

      if (logFilterDate === 'today') {
        if (logDate < today) return false;

      } else if (logFilterDate === 'week') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        if (logDate < weekStart) return false;

      } else if (logFilterDate === 'month') {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        if (logDate < monthStart) return false;

      } else if (logFilterDate === 'custom') {
        if (logDateFrom) {
          const from = new Date(logDateFrom);
          if (logDate < from) return false;
        }
        if (logDateTo) {
          const to = new Date(logDateTo);
          to.setHours(23, 59, 59, 999);
          if (logDate > to) return false;
        }
      }
    }

    return true;
  });
}

// ✅ CHANGED: now delegates to the shared sliding-window pagination helper
function _renderLogPagination(total) {
  renderPaginationControls('log-pagination-container', total, logsPerPage, currentLogPage, (newPage) => {
    currentLogPage = newPage;
    renderLogs();
  });
}

async function renderLogs() {
  try {
    const res  = await fetch(`${API_URL}/api/logs`);
    const logs = await res.json();

    const filtered  = _filterLogs(logs);
    const total     = filtered.length;
    const start     = (currentLogPage - 1) * logsPerPage;
    const paginated = filtered.slice(start, start + logsPerPage);

    const tbody = document.getElementById('log-tbody');
    tbody.innerHTML = '';

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--slate-400)">No logs found.</td></tr>`;
    } else {
      paginated.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'tr-clickable';
        tr.innerHTML = `
          <td style="font-size:11px; font-family:var(--mono)">${new Date(log.date_time).toLocaleString()}</td>
          <td>${log.name || '—'}</td>
          <td><span class="log-action-badge ${_logActionCls(log.action_type)}">${log.action_type}</span></td>
          <td><span class="badge b-slate b-none">${log.module}</span></td>
          <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px">${log.description || '—'}</td>
          <td>${log.performed_by || '—'}</td>
        `;
        tr.addEventListener('click', () => openDP('log', log.log_id, tr));
        tbody.appendChild(tr);
      });
    }

    document.getElementById('log-ct').textContent = `${total} entries`;
    _renderLogPagination(total);

  } catch (err) {
    console.error(err);
    showToast('Failed to load logs', 't-error');
  }
}

function _logActionCls(action) {
  const map = {
    CREATE:   'la-create',
    UPDATE:   'la-update',
    DELETE:   'la-delete',
    DELIVER:  'la-deliver',
    WITHDRAW: 'la-withdraw',
    REQUEST:  'la-request',
    LOGIN:    'la-system',
    LOGOUT:   'la-system',
  };
  return map[action] || 'la-system';
}

async function exportLogs() {
  try {
    const res  = await fetch(`${API_URL}/api/logs`);
    const logs = await res.json();
    const filtered = _filterLogs(logs);

    if (!filtered.length) { showToast('No logs to export', 't-error'); return; }

    const headers = ['Timestamp', 'User', 'Action', 'Module', 'Description', 'Performed By'];
    const rows = filtered.map(l => [
      `"${new Date(l.date_time).toLocaleString()}"`,
      `"${l.name || ''}"`,
      `"${l.action_type || ''}"`,
      `"${l.module || ''}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${l.performed_by || ''}"`
    ].join(','));

    const csv  = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `SystemLogs_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Logs exported', 't-success');
  } catch (err) {
    console.error(err);
    showToast('Export failed', 't-error');
  }
}

function dpLog(id) {
  // dp body is already rendered from the row click
  // fetch single log for detail panel
  fetch(`${API_URL}/api/logs`)
    .then(r => r.json())
    .then(logs => {
      const l = logs.find(x => x.log_id === id);
      if (!l) return;

      const clsMap = {
        CREATE:'la-create', UPDATE:'la-update', DELETE:'la-delete',
        DELIVER:'la-deliver', WITHDRAW:'la-withdraw', REQUEST:'la-request',
        LOGIN:'la-system', LOGOUT:'la-system'
      };

      setDPHeader(
        '📜', '#f8fafc',
        `Log #${l.log_id}`,
        l.module
      );

      document.getElementById('dp-body').innerHTML = `
        <div class="dp-section">
          <div class="dp-section-hd">📜 Log Entry</div>
          <div class="dp-grid">
            ${dpField('Log ID',      `#${l.log_id}`,   'mono')}
            ${dpField('Timestamp',   new Date(l.date_time).toLocaleString(), 'mono')}
            ${dpField('User',        l.name || '—')}
            ${dpField('Action',      `<span class="log-action-badge ${clsMap[l.action_type] || 'la-system'}">${l.action_type}</span>`)}
            ${dpField('Module',      l.module)}
            ${dpField('Performed By',l.performed_by || '—')}
            ${dpFieldFull('Description', l.description || '—')}
          </div>
        </div>`;

      document.getElementById('dp-footer').style.display = 'none';
    });
}

function clearLogs() {
  if (!confirm('Clear all system logs? This cannot be undone.')) return;
  logs = [];
  logId = 1;
  renderLogs();
  showToast('Logs cleared','t-warning');
}

























/* ──────────────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────────────── */

function initAllModules() {
  renderInventory();
  renderFurniture();
  renderITSupplies();
  renderLaptops();
  renderOrders();
  renderVehicles();
  renderSubscriptionsUnified()
  renderFinance();
  renderLogs();
  renderUsers();
  renderContracts();
  loadFurLocations();
  loadFinanceCategories()
  checkMonthlyOdoReminder();
  refreshDashboard();
  refreshPageActions('dashboard');

  // Keyboard: Escape closes panels/modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      if (dpOpen) closeDP();
    }
  });

  // ── Log search listener ──
  const logSearch = document.getElementById('log-search');
  if (logSearch) {
    logSearch.addEventListener('input', () => {
      logSearchQuery = logSearch.value.trim().toLowerCase();
      currentLogPage = 1;
      renderLogs();
    });
  }

  // ── User search listener ──
  const userSearch = document.getElementById('user-search');
  if (userSearch) {
    userSearch.addEventListener('input', () => {
      userSearchQuery = userSearch.value.trim().toLowerCase();
      currentUserPage = 1;
      _renderUserTable();
    });
  }

  // ── Furniture search listener ──
  const furSearch = document.getElementById('fur-search');
  if (furSearch) {
    furSearch.addEventListener('input', () => {
      furSearchQuery = furSearch.value.trim().toLowerCase();
      currentFurPage = 1;
      _renderFurTable();
    });
  }

  // ── IT Supplies search listener ──
  const itSearch = document.getElementById('it-search');
  if (itSearch) {
    itSearch.addEventListener('input', () => {
      itSearchQuery = itSearch.value.trim().toLowerCase();
      currentITPage = 1;
      _renderITTable();
    });
  }

  // ── Contracts search listener ──
  const conSearch = document.getElementById('con-search');
  if (conSearch) {
    conSearch.addEventListener('input', () => {
      conSearchQuery = conSearch.value.trim().toLowerCase();
      currentConPage = 1;
      _renderConTable();
    });
  }

  // ── Finance search listener ──
  const finSearch = document.getElementById('fin-search');
  if (finSearch) {
    finSearch.addEventListener('input', () => {
      finSearchQuery = finSearch.value.trim().toLowerCase();
      currentFinPage = 1;
      _renderFinTable();
    });
  }

  // ── Laptop search listener ──
  const lpSearch = document.getElementById('lp-search');
  if (lpSearch) {
    lpSearch.addEventListener('input', () => {
      lpSearchQuery = lpSearch.value.trim().toLowerCase();
      currentLpPage = 1;
      _renderLpTable();
    });
  }

  // ── Purchase Orders search listener ──
  const poSearch = document.getElementById('po-search');
  if (poSearch) {
    poSearch.addEventListener('input', () => {
      poSearchQuery = poSearch.value.trim().toLowerCase();
      currentPOPage = 1;
      _renderPOTable();
    });
  }

  // ── Insurance search listener ──
  const insSearch = document.getElementById('ins-search');
  if (insSearch) {
    insSearch.addEventListener('input', () => {
      insSearchQuery = insSearch.value.trim().toLowerCase();
      currentInsPage = 1;
      _renderInsTable();
    });
  }
}

let lastRequestCheck = 0;
 
setInterval(async () => {
  if (document.hidden) return;
  if (_contractRefreshInFlight) return; // ✅ FIX: don't race a live action refresh
 
  try {
    const res = await fetch(`${API_URL}/api/contracts/requests`);
    const data = await res.json();
 
    const latestTime = new Date(data[0]?.request_date || 0).getTime();
 
    if (latestTime !== lastRequestCheck) {
      lastRequestCheck = latestTime;
 
      await renderContracts();
 
      if (dpOpen && dpCurrentType === "contracts") {
        await dpContract(dpCurrentId);
      }
    }
  } catch (e) {
    console.error("Polling error", e);
  }
}, 3000);




setInterval(() => {
  if (document.hidden) return;
  if (currentPage !== "dashboard") return;
  // refreshDashboard() already uses _setText/_setHTML which only
  // mutate individual element text/innerHTML — no full re-render.
  refreshDashboard();
}, 5 * 60 * 1000);










/* ──────────────────────────────────────────────────────────────
   LOGS
────────────────────────────────────────────────────────────── */
window.onload = function () {
  autoLogin();
};