// ============================================================
// nav.js — Sidebar navigation + page routing
// CHANGES (this pass — Sidebar Redesign):
//  - buildSidebar(): nav item label text is now wrapped in a
//    <span class="nav-label"> so style.css can fade/slide it in
//    only while the sidebar is hovered/expanded (icon-only at rest).
//    Previously the label was a bare text node sibling of the icon,
//    which meant it couldn't be independently hidden without also
//    hiding the icon.
//  - No functional changes to navigate()/_loadPageData()/
//    refreshPageActions() — those were already correct.
// ============================================================



function navigate(page, navEl) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

  if (page === "users" && currentUser.role !== "super_admin") {
    showToast("Access denied", "t-error");
    return;
  }

  if (!navEl) {
    const autoNav = document.getElementById("nav-" + page);
    if (autoNav) autoNav.classList.add("active");
  }

  const pageEl = document.getElementById("page-" + page);
  if (!pageEl) return;

  pageEl.classList.add("active");
  if (navEl) navEl.classList.add("active");

  const meta = PAGE_META[page] || {};
  document.getElementById("tb-parent").textContent  = meta.parent || "Asset Management System";
  document.getElementById("tb-current").textContent = meta.title  || page;

  currentPage = page;
  sessionStorage.setItem("currentPage", page);

  closeDP();
  refreshPageActions(page);

  // Lazy-load page data on navigate
  _loadPageData(page);
}

function _loadPageData(page) {
  const loaders = {
    dashboard:     () => refreshDashboard(),
    inventory:     () => renderInventory(),
    orders:        () => renderOrders(),
    furniture:     () => renderFurniture(),
    itsupplies:    () => renderITSupplies(),
    laptops:       () => renderLaptops(),
    vehicles:      () => renderVehicles(),
    contracts:     () => renderContracts(),
    subscriptions: () => renderSubscriptionsUnified(),
    insurance:     () => renderInsurance(),
    finance:       () => renderFinance(),
    logs:          () => renderLogs(),
    users:         () => renderUsers(),
  };
  if (loaders[page]) loaders[page]();
}

function refreshPageActions(page) {
  const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";

  const actions = {
    inventory:  () => {
      const el = document.getElementById("inv-actions");
      if (el) el.innerHTML = isAdmin
        ? `<button class="btn btn-green btn-sm" onclick="openAddInventory()">➕ Add Item</button>` : "";
    },
    furniture:  () => {
      const el = document.getElementById("fur-actions");
      if (el) {
        el.innerHTML = isAdmin
          ? `<button class="btn btn-green btn-sm" onclick="openAddFurniture()"><i data-lucide="plus"></i> Add Furniture</button>` : "";
        if (window.lucide) lucide.createIcons();
      }
    },
    itsupplies: () => {
      const el = document.getElementById("it-actions");
      if (el) {
        el.innerHTML = isAdmin
          ? `<button class="btn btn-green btn-sm" onclick="openAddIT()"><i data-lucide="plus"></i> Add IT Supply</button>` : "";
        if (window.lucide) lucide.createIcons();
      }
    },
    laptops:    () => {
      const el = document.getElementById("lp-actions");
      if (el) {
        el.innerHTML = isAdmin
          ? `<button class="btn btn-green btn-sm" onclick="openAddLaptop()"><i data-lucide="plus"></i> Add Laptop</button>` : "";
        if (window.lucide) lucide.createIcons();
      }
    },
    vehicles:   () => {
      const el = document.getElementById("veh-actions");
      if (el) {
        el.innerHTML = isAdmin
          ? `<button class="btn btn-green btn-sm" onclick="openM('m-add-veh')"><i data-lucide="plus"></i> Add Vehicle</button>` : "";
        if (window.lucide) lucide.createIcons();
      }
    },
    contracts: () => {
      const el = document.getElementById("con-actions");
      if (el && isAdmin) {
        el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openAddContract()"><i data-lucide="plus"></i> Add Contract</button>`;
        if (window.lucide) lucide.createIcons();
      }
    },
    insurance:  () => {
      const el = document.getElementById("ins-actions");
      if (el) {
        el.innerHTML = isAdmin
          ? `<button class="btn btn-green btn-sm" onclick="openAddInsurance()"><i data-lucide="plus"></i> Add Insurance</button>` : "";
        if (window.lucide) lucide.createIcons();
      }
    },
    finance:    () => {
      const el = document.getElementById("fin-actions");
      if (el) el.innerHTML =
        `<button class="btn btn-green btn-sm" onclick="openAddFinance()">➕ Add Folder</button>`;
    },
  };

  if (actions[page]) actions[page]();
}

const NOTIFICATION_MODULES = ['contracts', 'vehicle', 'insurance', 'm365', 'globe', 'subscriptions'];

async function refreshNotifications() {
  if (!currentUser) return;
  try {
    const res  = await fetch(`${API_URL}/api/notifications/${currentUser.user_id}`);
    const data = await res.json();
    _renderNotificationBadge(data.count || 0);
  } catch (err) {
    console.error('refreshNotifications error:', err);
  }
}

function buildSidebar() {
  const nav = document.getElementById("sb-nav");
  nav.innerHTML = "";
  let items;

  if (currentUser.role === "super_admin") {
    items = ADMIN_NAV;
  } else {
    items = ADMIN_NAV
      .filter(n => n.id !== "users")
      .filter(n => EMP_NAV.includes(n.id) || currentUser.role === "admin");
  }

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "nav-item" + (item.id === "dashboard" ? " active" : "");
    div.id        = "nav-" + item.id;
    div.title     = item.label;
    div.onclick   = () => navigate(item.id, div);

    let extras = "";
    if (item.badge) extras  = `<span class="nav-badge" id="nb-${item.badge}" style="display:none">0</span>`;
    if (item.admin) extras += `<span class="nav-admin-tag">Admin</span>`;

    if (item.id === "dashboard") {
      div.innerHTML = `
        <span class="nav-icon-wrap">
          <i class="nav-icon" data-lucide="${item.icon}"></i>
          <span class="nav-notif-dot" id="nb-dash-dot" style="display:none"></span>
        </span>
        <span class="nav-label">${item.label}</span>
        <span class="nav-notif-count" id="nb-dash-count" style="display:none">0</span>
        ${extras}`;
    } else {
      div.innerHTML = `<i class="nav-icon" data-lucide="${item.icon}"></i><span class="nav-label">${item.label}</span>${extras}`;
    }

    nav.appendChild(div);
  });

  if (window.lucide) lucide.createIcons();

  refreshNotifications();
}


function _renderNotificationBadge(count) {
  const navItem = document.getElementById('nav-dashboard');
  const dot     = document.getElementById('nb-dash-dot');
  const label   = document.getElementById('nb-dash-count');
  if (!navItem || !dot || !label) return;

  if (count > 0) {
    navItem.classList.add('has-notif');
    dot.style.display   = 'block';
    label.style.display = 'inline-flex';
    label.textContent   = count > 99 ? '99+' : count;
  } else {
    navItem.classList.remove('has-notif');
    dot.style.display   = 'none';
    label.style.display = 'none';
  }
}

function markNotificationSeen(module, recordId) {
  if (!NOTIFICATION_MODULES.includes(module)) return;
  if (!currentUser) return;
  fetch(`${API_URL}/api/notifications/seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.user_id, module, record_id: recordId }),
  }).then(refreshNotifications).catch(() => {});
}

setInterval(() => {
  if (document.hidden) return;
  refreshNotifications();
}, 60 * 1000);