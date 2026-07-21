
/* ──────────────────────────────────────────────────────────────
   FINANCIAL DOCUMENTS
────────────────────────────────────────────────────────────── */

const FIN_CATEGORY_MAP = {
  "Check Voucher": "CV",
  "Official Receipt": "OR",
  "Sales Invoice": "SI",
  "Purchase Order": "PO"
  // ✅ add more later here
};

// ── Filter/pagination state ──
let finSearchQuery    = '';
let finFilterCategory = 'all';
let finFilterLocation = 'all';
let currentFinPage    = 1;
const finPerPage      = 20;
let _allFinance       = [];

function _finRangeStr(f) {
  const start = String(f.range_start).padStart(4,'0');
  const end   = String(f.range_end).padStart(4,'0');
  return `${f.category_code}${f.year}${start} - ${f.category_code}${f.year}${end}`;
}

function applyFinFilters() {
  finFilterCategory = document.getElementById('fin-filter-category').value;
  finFilterLocation = document.getElementById('fin-filter-location').value;
  currentFinPage    = 1;
  _renderFinTable();
}

function _filterFinance(data) {
  return data.filter(f => {

    // Search — year, category, folder #, range
    if (finSearchQuery) {
      const haystack = `${f.year} ${f.category} ${f.folder_number} ${_finRangeStr(f)}`.toLowerCase();
      if (!haystack.includes(finSearchQuery)) return false;
    }

    // Category filter
    if (finFilterCategory !== 'all' && f.category !== finFilterCategory) return false;

    // Location filter
    if (finFilterLocation !== 'all' && f.location !== finFilterLocation) return false;

    return true;
  });
}

// ✅ CHANGED: now delegates to the shared sliding-window pagination helper
function _renderFinPagination(total) {
  renderPaginationControls('fin-pagination-container', total, finPerPage, currentFinPage, (newPage) => {
    currentFinPage = newPage;
    _renderFinTable();
  });
}

function _renderFinTable() {
  const filtered  = _filterFinance(_allFinance);
  const total     = filtered.length;
  const start     = (currentFinPage - 1) * finPerPage;
  const paginated = filtered.slice(start, start + finPerPage);

  const tbody = document.getElementById('fin-tbody');
  tbody.innerHTML = "";

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--slate-400)">No folders found.</td></tr>`;
  } else {
    paginated.forEach(f => {
      const tr = document.createElement("tr");
      tr.className = "tr-clickable";

      tr.innerHTML = `
        <td>${f.year}</td>
        <td>${f.folder_number}</td>
        <td>${f.category}</td>
        <td>${_finRangeStr(f)}</td>
        <td>${f.location}</td>
      `;

      tr.addEventListener("click", () => {
        openDP("finance", f.finance_id, tr);
      });

      tbody.appendChild(tr);
    });
  }

  document.getElementById("fin-ct").innerText = total + " folders";
  _renderFinPagination(total);
}

async function renderFinance() {
  const res  = await fetch(`${API_URL}/api/finance-documents`);
  _allFinance = await res.json();
  currentFinPage = 1;
  _renderFinTable();
}

async function saveFinance() {

  const category = document.getElementById("fin-f-cat").value;

  let existing = null;

  if (editFinanceId) {
    const res = await fetch(`${API_URL}/api/finance-documents/${editFinanceId}`);
    existing = await res.json();
  }

  const payload = {
    year: document.getElementById("fin-f-year").value,
    folder_number: document.getElementById("fin-f-folder").value,
    category,
    category_code: FIN_CATEGORY_MAP[category],
    range_start: parseInt(document.getElementById("fin-f-start").value),
    range_end: parseInt(document.getElementById("fin-f-end").value),
    remarks: document.getElementById("fin-f-remarks").value,

    // ✅ FIX HERE
    location: existing ? existing.location : "STORAGE"
  };

  const url = editFinanceId
    ? `${API_URL}/api/finance-documents/${editFinanceId}`
    : `${API_URL}/api/finance-documents`;

  const method = editFinanceId ? "PUT" : "POST";

  await fetch(url, {
    method,
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });

  const actionType = editFinanceId ? "UPDATE" : "CREATE";

  const year = document.getElementById("fin-f-year").value;
  const start = String(document.getElementById("fin-f-start").value).padStart(4, '0');
  const end   = String(document.getElementById("fin-f-end").value).padStart(4, '0');
  const category_code = FIN_CATEGORY_MAP[category];

  addLog(
    actionType,
    "FINANCE",
    `${actionType === "CREATE" ? "Added" : "Updated"} ${category} | ${category_code}${year}${start} - ${category_code}${year}${end}`,
    editFinanceId || null
  );
  showToast(editFinanceId ? "Document Updated" : "Document Saved", "t-success");

  editFinanceId = null;

  closeM("m-add-fin");
  renderFinance();

  if (dpOpen && dpCurrentType === "finance") {
    dpFinance(dpCurrentId);
  }
}

let deleteFinanceId = null;

function deleteFinance(id) {
  deleteFinanceId = id;
  openM("m-confirm-fin-del");
}

function confirmDeleteFinance() {

  fetch(`${API_URL}/api/finance-documents/${deleteFinanceId}`)
    .then(res => res.json())
    .then(f => {

      const start = String(f.range_start).padStart(4, '0');
      const end   = String(f.range_end).padStart(4, '0');

      const range = `${f.category_code}${f.year}${start} - ${f.category_code}${f.year}${end}`;

      return fetch(`${API_URL}/api/finance-documents/${deleteFinanceId}`, {
        method: "DELETE"
      }).then(() => ({ f, range }));
    })
    .then(({ f, range }) => {

      showToast("Document Deleted", "t-warning");
      closeM("m-confirm-fin-del");

      addLog(
        "DELETE",
        "FINANCE",
        `Deleted ${f.category} | ${range}`,
        deleteFinanceId
      );

      renderFinance();
    });
}

async function dpFinance(id) {
  const res = await fetch(`${API_URL}/api/finance-documents`);
  const data = await res.json();

  const f = data.find(x => x.finance_id === id);
  if (!f) return;

setDPHeader('folder', '#eff6ff', f.category, "Folder #" + f.folder_number);

  const start = String(f.range_start).padStart(4,'0');
  const end   = String(f.range_end).padStart(4,'0');
  const range = `${f.category_code}${f.year}${start} - ${f.category_code}${f.year}${end}`;

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="clipboard-list"></i> Details</div>
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
            <i data-lucide="arrow-left-right"></i> Move
          </button>`
        )}
      </div>
    </div>

    ${f.remarks ? `<div class="dp-section"><div class="dp-section-hd"><i data-lucide="sticky-note"></i> Remarks</div><div class="dp-grid">${dpFieldFull('Notes', f.remarks)}</div></div>` : ''}

    <div class="dp-section">
      <div class="dp-section-hd"><i data-lucide="zap"></i> Actions</div>
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm" onclick="editFinance(${f.finance_id})"><i data-lucide="pencil"></i> Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteFinance(${f.finance_id})"><i data-lucide="trash-2"></i> Delete</button>
        ${itemHistoryButton('finance', f.finance_id, `${f.category} · Folder #${f.folder_number}`)}
      </div>
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;

  if (window.lucide) lucide.createIcons();
}

let editFinanceId = null;
async function editFinance(id) {
  const res = await fetch(`${API_URL}/api/finance-documents`);
  const data = await res.json();

  const f = data.find(x => x.finance_id === id);
  if (!f) return;

  editFinanceId = id;

  openM("m-add-fin");

  setTimeout(() => {
    const catSelect = document.getElementById("fin-f-cat");

    loadFinanceCategories();
    catSelect.value = f.category;

    document.getElementById("fin-f-start").value =
      String(f.range_start).padStart(4, '0');

    document.getElementById("fin-f-end").value =
      String(f.range_end).padStart(4, '0');

    document.getElementById("fin-f-year").value = f.year;
    document.getElementById("fin-f-folder").value = f.folder_number;
    document.getElementById("fin-f-remarks").value = f.remarks || "";

  }, 100);
}

function loadFinanceCategories() {
  const select = document.getElementById("fin-f-cat");

  select.innerHTML = '<option value="">Select Category</option>';

  Object.keys(FIN_CATEGORY_MAP).forEach(cat => {
    select.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

function autoSetCode() {
  const category = document.getElementById("fin-f-cat").value;
  const code = FIN_CATEGORY_MAP[category] || "";

  document.getElementById("fin-f-code").value = code;
}


function openAddFinance() {
  editFinanceId = null;

  openM("m-add-fin");

  const catSelect = document.getElementById("fin-f-cat");

  loadFinanceCategories();

  catSelect.disabled = false; 
  catSelect.value = ""; 
}

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
         <i data-lucide="arrow-right"></i>
         <span class="badge ${nextLoc === 'STORAGE' ? 'b-green' : 'b-blue'}">${nextLoc}</span>`;

      document.getElementById('fin-move-by').value = '';
      selectState['fin-move-by'] = false;
      document.getElementById('fin-move-remarks').value = '';

      openM('m-fin-move');
      _loadFinMoveUsers();

      if (window.lucide) lucide.createIcons();
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



if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.finance = dpFinance;