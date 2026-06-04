function buildSidebar() {
  const nav = document.getElementById('sb-nav');
  nav.innerHTML = '';
  const items = currentUser.role === 'admin' ? ADMIN_NAV : ADMIN_NAV.filter(n => EMP_NAV.includes(n.id));

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
  document.getElementById('tb-parent').textContent = meta.parent || 'AssetCore';
  document.getElementById('tb-current').textContent = meta.title || page;

  currentPage = page;
  localStorage.setItem("currentPage", page);

  closeDP();
  refreshPageActions(page);
}


function refreshPageActions(page) {
  const isAdmin = currentUser.role === 'admin';

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
      if (isAdmin) el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openM('m-add-it')">➕ Add IT Supply</button>`;
      else el.innerHTML = '';
    },
    laptops:    () => {
      const el = document.getElementById('lp-actions');
      if (isAdmin) el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openM('m-add-lp')">➕ Add Laptop</button>`;
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
      el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openM('m-add-globe')">➕ Add Plan</button>`;
    },
    m365:       () => {
      const el = document.getElementById('m365-actions');
      el.innerHTML = `<button class="btn btn-green btn-sm" onclick="openM('m-add-m365')">➕ Add License</button>`;
    },
  };

  if (actions[page]) actions[page]();
  if (page === "logs") {
    renderLogs();
  }
}