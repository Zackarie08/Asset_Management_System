// ============================================================
// nav.js — Sidebar navigation + page routing
// CHANGES:
//  - Removed globe, m365, master-subscriptions from ADMIN_NAV
//    (merged into unified "subscriptions" module)
//  - openDP renderers still include globe/m365/subscriptions
//    since unified table still routes to individual DPs
//  - insurance dpType added to openDP renderer map
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
    div.onclick   = () => navigate(item.id, div);

    let extras = "";
    if (item.badge) extras  = `<span class="nav-badge" id="nb-${item.badge}" style="display:none">0</span>`;
    if (item.admin) extras += `<span class="nav-admin-tag">Admin</span>`;

    div.innerHTML = `<span class="nav-icon">${item.icon}</span> ${item.label} ${extras}`;
    nav.appendChild(div);
  });
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
  localStorage.setItem("currentPage", page);

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
      if (el) el.innerHTML = isAdmin
        ? `<button class="btn btn-green btn-sm" onclick="openAddFurniture()">➕ Add Furniture</button>` : "";
    },
    itsupplies: () => {
      const el = document.getElementById("it-actions");
      if (el) el.innerHTML = isAdmin
        ? `<button class="btn btn-green btn-sm" onclick="openAddIT()">➕ Add IT Supply</button>` : "";
    },
    laptops:    () => {
      const el = document.getElementById("lp-actions");
      if (el) el.innerHTML = isAdmin
        ? `<button class="btn btn-green btn-sm" onclick="openAddLaptop()">➕ Add Laptop</button>` : "";
    },
    vehicles:   () => {
      const el = document.getElementById("veh-actions");
      if (el) el.innerHTML = isAdmin
        ? `<button class="btn btn-green btn-sm" onclick="openM('m-add-veh')">➕ Add Vehicle</button>` : "";
    },
    contracts:  () => {
      const el = document.getElementById("con-actions");
      if (el && isAdmin) el.innerHTML =
        `<button class="btn btn-green btn-sm" onclick="openM('m-add-con')">➕ Add Contract</button>`;
    },
    insurance:  () => {
      const el = document.getElementById("ins-actions");
      if (el) el.innerHTML = isAdmin
        ? `<button class="btn btn-green btn-sm" onclick="openM('m-ins-add')">➕ Add Insurance</button>` : "";
    },
    finance:    () => {
      const el = document.getElementById("fin-actions");
      if (el) el.innerHTML =
        `<button class="btn btn-green btn-sm" onclick="openAddFinance()">➕ Add Folder</button>`;
    },
  };

  if (actions[page]) actions[page]();
}
