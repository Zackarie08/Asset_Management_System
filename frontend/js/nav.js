function buildSidebar() {
  const nav = document.getElementById('sb-nav');
  nav.innerHTML = '';
  let items;

  if (currentUser.role === "super_admin") {
    // ✅ full access
    items = ADMIN_NAV;

  } else {
    // ✅ admin + employee (NO users page)
    items = ADMIN_NAV.filter(n => n.id !== "users")
                    .filter(n => EMP_NAV.includes(n.id) || currentUser.role === "admin");
  }

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'nav-item' + (item.id === 'dashboard' ? ' active' : '');
    div.id = 'nav-' + item.id;
    div.onclick = () => navigate(item.id, div);

    let extras = '';
    if (item.badge) extras = `<span class="nav-badge" id="nb-${item.badge}" style="display:none">0</span>`;
    if (item.admin) extras += `<span class="nav-admin-tag">Admin</span>`;

    div.innerHTML = `<span class="nav-icon">${item.icon}</span> ${item.label} ${extras}`;
    nav.appendChild(div);
  });
}
function navigate(page, navEl) {
  // ✅ remove active first
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (page === "users" && currentUser.role !== "super_admin") {
    showToast("Access denied", "t-error");
    return;
  }


  // ✅ auto highlight when refresh (no navEl)
  if (!navEl) {
    const autoNav = document.getElementById('nav-' + page);
    if (autoNav) autoNav.classList.add('active');
  }

  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return;

  pageEl.classList.add('active');

  // ✅ normal click highlight
  if (navEl) navEl.classList.add('active');

  const meta = PAGE_META[page] || {};
  document.getElementById('tb-parent').textContent = meta.parent || 'Asset Management System';
  document.getElementById('tb-current').textContent = meta.title || page;

  currentPage = page;
  localStorage.setItem("currentPage", page);

  closeDP();
  refreshPageActions(page);
}


function refreshPageActions(page) {
    const isAdmin =
      currentUser.role === 'admin' ||
      currentUser.role === 'super_admin';

  const actions = {
    inventory:  () => {
      const el = document.getElementById('inv-actions');
      if (isAdmin) el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openAddInventory()">➕ Add Item</button><button class="btn btn-outline btn-sm" onclick="showToast('Exported!','t-success')">📥 Export</button>`;
      else el.innerHTML = '';
    },
    furniture:  () => {
      const el = document.getElementById('fur-actions');
      if (isAdmin) el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openM('m-add-fur')">➕ Add Furniture</button>`;
      else el.innerHTML = '';
    },
    itsupplies: () => {
      const el = document.getElementById('it-actions');
      if (isAdmin) el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openAddIT()">➕ Add IT Supply</button>`;
      else el.innerHTML = '';
    },
    laptops:    () => {
      const el = document.getElementById('lp-actions');
      if (isAdmin) el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openAddLaptop()">➕ Add Laptop</button>`;
      else el.innerHTML = '';
    },
  orders: () => {
    const el = document.getElementById('po-actions');
    el.innerHTML = ''; // ✅ REMOVE BUTTON
  },
    vehicles:   () => {
      const el = document.getElementById('veh-actions');
      if (isAdmin) el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openM('m-add-veh')">➕ Add Vehicle</button>`;
      else el.innerHTML = '';
    },
    globe:      () => {
      const el = document.getElementById('globe-actions');
      el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openAddGlobe()">➕ Add Plan</button>`;
    },
    m365:       () => {
      const el = document.getElementById('m365-actions');
      el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openM('m-add-m365')">➕ Add License</button>`;
    },
    finance: () => {
      const el = document.getElementById('fin-actions');
      el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openM('m-add-fin')">➕ Add Folder</button>`;
    },
  };

  if (actions[page]) actions[page]();
  if (page === "logs") {
    renderLogs();
  }
  if (page === "users") {
    renderUsers();
  }
  if (page === "page-vehicles") {
    renderVehicles();
  }
}