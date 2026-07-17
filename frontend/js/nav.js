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
    div.title     = item.label; // native tooltip while collapsed
    div.onclick   = () => navigate(item.id, div);

    let extras = "";
    if (item.badge) extras  = `<span class="nav-badge" id="nb-${item.badge}" style="display:none">0</span>`;
    if (item.admin) extras += `<span class="nav-admin-tag">Admin</span>`;

    div.innerHTML = `<i class="nav-icon" data-lucide="${item.icon}"></i><span class="nav-label">${item.label}</span>${extras}`;
    nav.appendChild(div);
  });

  if (window.lucide) lucide.createIcons();
}

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
      if (el) el.innerHTML = isAdmin
        ? `<button class="btn btn-green btn-sm" onclick="openAddInsurance()">➕ Add Insurance</button>` : "";
    },
    finance:    () => {
      const el = document.getElementById("fin-actions");
      if (el) el.innerHTML =
        `<button class="btn btn-green btn-sm" onclick="openAddFinance()">➕ Add Folder</button>`;
    },
  };

  if (actions[page]) actions[page]();
}