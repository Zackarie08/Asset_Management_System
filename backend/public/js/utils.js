// ✅ NEW — shared renewal/expiry alert lead time (days), mirrors
// ALERT_WINDOW_DAYS in backend/utils/renewalAlerts.js.
const RENEWAL_ALERT_WINDOW_DAYS = 60;

const ADMIN_NAV = [
  { id: "dashboard",     icon: "layout-dashboard", label: "Dashboard"           },
  { id: "inventory",     icon: "box",              label: "Inventory Management", badge: "inv" },
  { id: "orders",        icon: "shopping-cart",    label: "Purchase Orders",     badge: "po"  },
  { id: "furniture",     icon: "armchair",         label: "Office Furniture"     },
  { id: "itsupplies",    icon: "plug",             label: "IT Supplies",         badge: "it"  },
  { id: "laptops",       icon: "laptop",           label: "Laptops"              },
  { id: "vehicles",      icon: "car",              label: "Vehicle Management"   },
  { id: "contracts",     icon: "file-text",        label: "Contracts"            },
  { id: "subscriptions", icon: "calendar-clock",   label: "Subscriptions",       admin: true  },
  { id: "insurance",     icon: "shield",           label: "Insurance",           admin: true  },
  { id: "finance",       icon: "folder",           label: "Finance Documents",   admin: true  },
  { id: "logs",          icon: "scroll-text",      label: "System Logs",         admin: true  },
  { id: "users",         icon: "users",            label: "Users",               admin: true  },
];

// Pages accessible to non-admin roles
const EMP_NAV = [
  "dashboard","inventory","orders","furniture",
  "itsupplies","laptops","vehicles","contracts"
];

/* ── PAGE METADATA (breadcrumb) ─────────────────────────── */
const PAGE_META = {
  dashboard:     { title: "Dashboard",            parent: "Asset Management System" },
  inventory:     { title: "Inventory Management", parent: "Asset Management System" },
  orders:        { title: "Purchase Orders",      parent: "Asset Management System" },
  furniture:     { title: "Office Furniture",     parent: "Asset Management System" },
  itsupplies:    { title: "IT Supplies",          parent: "Asset Management System" },
  laptops:       { title: "Laptop Management",    parent: "Asset Management System" },
  vehicles:      { title: "Vehicle Management",   parent: "Asset Management System" },
  contracts:     { title: "Contracts",            parent: "Asset Management System" },
  subscriptions: { title: "Subscriptions",        parent: "Asset Management System" },
  insurance:     { title: "Insurance",            parent: "Asset Management System" },
  finance:       { title: "Finance Documents",    parent: "Asset Management System" },
  logs:          { title: "System Logs",          parent: "Asset Management System" },
  users:         { title: "Users",                parent: "Asset Management System" },
};

/* ── EDIT STATE (was accidental global) ─────────────────── */
// ✅ FIX: declare with let so it doesn't pollute the global scope implicitly
let editState = { id: null, type: null };
let dpOpen = false;
let dpSelectedRow = null;
let dpCurrentType = null;
let dpCurrentId   = null;

/* ── DP RENDERER MAP ────────────────────────────────────── */
// Used inside openDP() — maps type strings to handler functions.
// Note: globe/m365/subscriptions remain so that clicking unified
// table rows still opens the correct type-specific detail panel.
// ✅ FIX: store the FUNCTION NAME (string), not the function reference.
// Storing the reference directly (dpFurniture, dpContract, etc.) freezes
// whatever those names point to at the exact moment this script runs —
// which breaks the moment a module's dp*() function lives in a file
// loaded AFTER main.js (as with the furniture/itsupplies/laptop/contracts/
// finance/user modules now that they've been split out). Looking the
// function up by name INSIDE openDP() instead means resolution happens
// at click-time, when every script has already loaded — so load order
// stops mattering entirely, and this never needs "re-pointing" again.
const DP_RENDERERS = {
  inventory:     'dpInventory',
  furniture:     'dpFurniture',
  order:         'dpOrder',
  itsupplies:    'dpITSupplies',
  laptop:        'dpLaptop',
  vehicle:       'dpVehicle',
  contracts:     'dpContract',
  subscriptions: 'dpSubscriptions',
  globe:         'dpGlobe',
  m365:          'dpM365',
  insurance:     'dpInsurance',
  finance:       'dpFinance',
  log:           'dpLog',
  user:          'dpUser',
};


function openDP(type, id, row) {
  if (dpSelectedRow) dpSelectedRow.classList.remove("selected");
  dpSelectedRow = row;
  dpCurrentType = type;
  dpCurrentId   = id;
  if (row) row.classList.add("selected");

  document.getElementById("detail-panel").classList.add("open");
  document.getElementById("app-body").classList.add("panel-open");
  dpOpen = true;

  const renderer = DP_RENDERERS[type];
  if (renderer) {
    renderer(id);
  } else {
    console.warn(`No DP renderer registered for type: "${type}"`);
  }

  // ✅ NEW (Part 1): viewing the record acknowledges its notification(s).
  markNotificationSeen(type, id);
}



function closeDP() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('app-body').classList.remove('panel-open');
  if (dpSelectedRow) { dpSelectedRow.classList.remove('selected'); dpSelectedRow = null; }
  dpOpen = false; dpCurrentType = null; dpCurrentId = null;
}

function setDPHeader(icon, iconBg, title, sub) {
  const el = document.getElementById('dp-icon');
  el.innerHTML = `<i data-lucide="${icon}"></i>`;
  el.style.background = iconBg;
  document.getElementById('dp-title').textContent    = title;
  document.getElementById('dp-subtitle').textContent = sub;
  if (window.lucide) lucide.createIcons();
}




function todayStr() { return new Date().toISOString().slice(0,10); }

// ✅ NEW: shared human-readable date formatter used across the Dashboard,
// Contracts, Insurance, Subscriptions, and Vehicles modules.
// "2026-09-06T00:00:00.000Z" → "September 6, 2026"
function formatDateHuman(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Same "Mon D, YYYY" style as formatDateHuman, plus time — only for
// fields that are genuinely timestamps (Activity Log, Item History),
// never for date-only fields.
function formatDateTimeHuman(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

function clearForm(ids) { ids.forEach(id => { const el=document.getElementById(id); if(el) el.value=''; }); }

function showToast(msg, type='t-success') {
  const icons = { 't-success':'✅','t-error':'❌','t-warning':'⚠️','t-info':'ℹ️' };
  const wrap = document.getElementById('toast-wrap');
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'all .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// Helpers for DP content
function dpField(label, value, cls='') {
  const valHTML = value
    ? `<div class="dp-value ${cls}">${value}</div>`
    : `<div class="dp-value muted">—</div>`;
  return `<div class="dp-field"><div class="dp-label">${label}</div>${valHTML}</div>`;
}
function dpFieldFull(label, value, cls='') {
  const valHTML = value
    ? `<div class="dp-value ${cls}">${value}</div>`
    : `<div class="dp-value muted">—</div>`;
  return `<div class="dp-field full"><div class="dp-label">${label}</div>${valHTML}</div>`;
}
function dpSection(title, icon='') {
  return `<div class="dp-section-hd">${icon ? icon+' ' : ''}${title}</div>`;
}
function badge(text, cls) { return `<span class="badge ${cls}">${text}</span>`; }


/* ──────────────────────────────────────────────────────────────
   MODAL HELPERS
────────────────────────────────────────────────────────────── */
function openM(id)  { 
  document.getElementById(id).classList.add('open'); 
}

function closeM(id) {
  const el = document.getElementById(id);
  el.classList.remove("open");

  // ✅ auto reset form inside modal
  resetForm(id);
}

function resetForm(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const inputs = container.querySelectorAll("input, textarea, select");

  inputs.forEach(el => {
    if (el.tagName === "SELECT") {
      el.selectedIndex = 0;
    } else {
      el.value = "";
    }
  });
}

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) {
      e.stopPropagation();
    }
  });
});

function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = "password";
    icon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide) lucide.createIcons();
}


const LIMITS = {
  NAME: 50,
  EMAIL: 50,
  PASSWORD: 50,
  REMARKS: 255
};

const selectState = {}; 

function makeSearchable(inputId, listId, items) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  if (!input || !list) return; 

  selectState[inputId] = false;

  input.addEventListener("input", () => {
    selectState[inputId] = false;

    const val = input.value.toLowerCase();
    list.innerHTML = "";

    const filtered = items.filter(i =>
      i.toLowerCase().includes(val)
    );

    filtered.forEach(name => {
      const div = document.createElement("div");
      div.textContent = name;
      div.className = "select-item";

      div.onclick = () => {
        input.value = name;
        list.innerHTML = "";
        selectState[inputId] = true;
      };

      list.appendChild(div);
    });
  });

  // ✅ prevent Enter submit
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   SHARED PAGINATION CONTROL
   ──────────────────────────────────────────────────────────────
   Sliding-window pagination, no ellipsis. Shows up to 10 page
   numbers at once. Window stays fixed at 1-10 while the current
   page is within the first 6; once current page reaches 7+, the
   window slides so the current page always sits as the 6th number
   shown, clamped so it never goes past page 1 or the last page.

   Named renderPaginationControls (not renderPagination) to avoid
   colliding with inventory.js's existing global renderPagination().

   @param containerId  - id of the element to render controls into
   @param total         - total number of filtered items
   @param perPage       - items per page
   @param currentPage   - the currently active page (1-indexed)
   @param onPageChange  - callback(newPage) fired when a page/prev/next is clicked
───────────────────────────────────────────────────────────────── */
function renderPaginationControls(containerId, total, perPage, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(total / perPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const WINDOW_SIZE = 10;
  let start, end;

  if (totalPages <= WINDOW_SIZE) {
    start = 1;
    end = totalPages;
  } else {
    // current page sits at the 6th slot once sliding begins, clamped at both ends
    start = Math.min(Math.max(currentPage - 5, 1), totalPages - WINDOW_SIZE + 1);
    end = start + WINDOW_SIZE - 1;
  }

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentPage === 1;
  prev.onclick = () => onPageChange(currentPage - 1);
  wrap.appendChild(prev);

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => onPageChange(i);
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentPage === totalPages;
  next.onclick = () => onPageChange(currentPage + 1);
  wrap.appendChild(next);

  container.appendChild(wrap);
}

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
