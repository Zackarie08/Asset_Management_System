/* ──────────────────────────────────────────────────────────────
   SESSION / AUTH
────────────────────────────────────────────────────────────── */
let currentUser = null; // { name, role, initials }




/* ──────────────────────────────────────────────────────────────
   SIDEBAR
────────────────────────────────────────────────────────────── */
const ADMIN_NAV = [
  { id:'dashboard',   icon:'🏠', label:'Dashboard',            badge:null },
  { id:'inventory',   icon:'📦', label:'Inventory Management', badge:'inv' },
  { id:'furniture',   icon:'🪑', label:'Office Furniture',     badge:null },
  { id:'itsupplies',  icon:'🖨️', label:'IT Supplies',          badge:'it' },
  { id:'laptops',     icon:'💻', label:'Laptops',              badge:null },
  { id:'orders',      icon:'🛒', label:'Purchase Orders',      badge:'po' },
  { id:'vehicles',    icon:'🚗', label:'Vehicle Management',   badge:null },
  { id:'globe',       icon:'📱', label:'Globe Mobile Plans',   badge:null, admin:true },
  { id:'m365',        icon:'💼', label:'M365 Licenses',        badge:null, admin:true },
  { id:'logs',        icon:'📜', label:'System Logs',          badge:null, admin:true },
  { id: 'users', label: 'Users', icon: '👤', page: 'page-users', admin:true },
];

const EMP_NAV = ['dashboard','inventory','furniture','itsupplies','laptops','orders'];





/* ──────────────────────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────────────────────── */
const PAGE_META = {
  dashboard:  { title:'Dashboard',         parent:'Asset Management System' },
  inventory:  { title:'Inventory Management', parent:'Asset Management System' },
  furniture:  { title:'Office Furniture',  parent:'Asset Management System' },
  itsupplies: { title:'IT Supplies',       parent:'Asset Management System' },
  laptops:    { title:'Laptop Management', parent:'Asset Management System' },
  orders:     { title:'Purchase Orders',   parent:'Asset Management System' },
  vehicles:   { title:'Vehicle Management',parent:'Asset Management System' },
  globe:      { title:'Globe Mobile Plans',parent:'Asset Management System' },
  m365:       { title:'M365 Licenses',     parent:'Asset Management System' },
  logs:       { title:'System Logs',       parent:'Asset Management System' },
  users:      { title:'Users',             parent:'Asset Management System' },
};

let currentPage = 'dashboard';





/* ──────────────────────────────────────────────────────────────
   DETAIL PANEL ENGINE
────────────────────────────────────────────────────────────── */
let dpOpen = false;
let dpSelectedRow = null;
let dpCurrentType = null;
let dpCurrentId   = null;

function openDP(type, id, row) {
  if (dpSelectedRow) dpSelectedRow.classList.remove('selected');
  dpSelectedRow = row;
  dpCurrentType = type;
  dpCurrentId   = id;
  if (row) row.classList.add('selected');

  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('app-body').classList.add('panel-open');
  dpOpen = true;

  const renderers = {
    inventory: dpInventory,
    furniture: dpFurniture,
    itsupplies: dpITSupplies,
    laptop:    dpLaptop,
    order:     dpOrder,
    vehicle:   dpVehicle,
    globe:     dpGlobe,
    m365:      dpM365,
    log:       dpLog,
  };
  if (renderers[type]) renderers[type](id);
  if (type === "vehicle") dpVehicle(id);
}

function closeDP() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('app-body').classList.remove('panel-open');
  if (dpSelectedRow) { dpSelectedRow.classList.remove('selected'); dpSelectedRow = null; }
  dpOpen = false; dpCurrentType = null; dpCurrentId = null;
}

function setDPHeader(icon, iconBg, title, sub) {
  const el = document.getElementById('dp-icon');
  el.textContent = icon; el.style.background = iconBg;
  document.getElementById('dp-title').textContent    = title;
  document.getElementById('dp-subtitle').textContent = sub;
}















/* ──────────────────────────────────────────────────────────────
   OFFICE FURNITURE
────────────────────────────────────────────────────────────── */

let furEditId = null;

async function renderFurniture() {
  const res = await fetch(`${API_URL}/api/furniture`);
  const data = await res.json();

  const tbody = document.getElementById('fur-tbody');
  tbody.innerHTML = '';

  data.forEach(f => {
    const tr = document.createElement('tr');

    tr.className = 'tr-clickable';

    tr.innerHTML = `
      <td>${f.furniture_name}</td>
      <td>${f.quantity}</td>
      <td>${f.date_of_purchase || '-'}</td>
      <td>₱${f.price?.toLocaleString() || 0}</td>
      <td>${f.location_name || '-'}</td>
      <td>${f.remarks || '-'}</td>
      <td>
        <button onclick="event.stopPropagation(); editFur(${f.office_furniture_id})">✏️</button>
        <button onclick="event.stopPropagation(); deleteFur(${f.office_furniture_id}, '${f.furniture_name}')">🗑️</button>
      </td>
    `;

    tr.addEventListener('click', () => {
      openDP('furniture', f.office_furniture_id, tr);
    });

    tbody.appendChild(tr);
  });
}

async function dpFurniture(id) {
  const res = await fetch(`${API_URL}/api/furniture`);
  const data = await res.json();

  const f = data.find(x => x.office_furniture_id === id);
  if (!f) return;

  setDPHeader('🪑','#fffbeb', f.furniture_name, 'Office Furniture');

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">📦 Furniture Details</div>
      <div class="dp-grid">
        ${dpField("Name", f.furniture_name)}
        ${dpField("Quantity", f.quantity)}
        ${dpField("Date Purchased", f.date_of_purchase || '-')}
        ${dpField("Price", f.price ? '₱' + f.price : '-')}
        ${dpField("Location", f.location_name || '-')}
        ${dpField("Remarks", f.remarks || '-')}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm"
          onclick="editFur(${f.office_furniture_id})">
          ✏️ Edit
        </button>

        <button class="btn btn-red btn-sm"
          onclick="deleteFur(${f.office_furniture_id}, '${f.furniture_name}')">
          🗑️ Delete
        </button>
      </div>
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}

function saveFurniture() {
  const name = document.getElementById('fur-f-name').value;
  const qty = document.getElementById('fur-f-qty').value;
  const date = document.getElementById('fur-f-date').value;
  const price = document.getElementById('fur-f-price').value;
  const loc = document.getElementById('fur-f-loc').value;
  const remarks = document.getElementById('fur-f-remarks').value;

  if (!name || !qty || !loc) {
    showToast("Fill required fields", "t-error");
    return;
  }

  // ✅ EDIT MODE
  if (furEditId) {
    fetch(`${API_URL}/api/furniture/${furEditId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        furniture_name: name,
        quantity: qty,
        date_of_purchase: date,
        price,
        remarks,
        current_location: loc
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Update failed");

      showToast("Furniture updated", "t-success");

      addLog(
        "UPDATE",
        "FURNITURE",
        `Updated furniture: ${name}`,
        name
      );

      furEditId = null;
      closeM("m-add-fur");
      renderFurniture();
    });

  } else {
    // ✅ ADD MODE
    fetch(`${API_URL}/api/furniture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        furniture_name: name,
        quantity: qty,
        date_of_purchase: date,
        price,
        remarks,
        current_location: loc
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Failed");

      showToast("Furniture added", "t-success");

      addLog(
        "CREATE",
        "FURNITURE",
        `Added furniture: ${name} (Qty: ${qty})`,
        name
      );

      closeM("m-add-fur");
      renderFurniture();
    });
  }
}

async function editFur(id) {
  const res = await fetch(`${API_URL}/api/furniture`);
  const data = await res.json();

  const f = data.find(x => x.office_furniture_id === id);
  if (!f) return;

  furEditId = id;

  openM('m-add-fur');

  await loadFurLocations();

  document.getElementById('fur-f-name').value = f.furniture_name;
  document.getElementById('fur-f-qty').value = f.quantity;
  let dateVal = "";

  if (f.date_of_purchase) {
    const d = new Date(f.date_of_purchase);
    dateVal = d.toISOString().split("T")[0];
  }

  document.getElementById('fur-f-date').value = dateVal;
  document.getElementById('fur-f-price').value = f.price || "";
  document.getElementById('fur-f-loc').value = f.current_location;
  document.getElementById('fur-f-remarks').value = f.remarks || "";
}


let deleteFurId = null;
let deleteFurName = "";

function deleteFur(id, name) {
  deleteFurId = id;
  deleteFurName = name;

  openM("m-confirm-fur-del");
}

function confirmDeleteFur() {
  fetch(`${API_URL}/api/furniture/${deleteFurId}`, {
    method: "DELETE"
  })
  .then(res => {
    if (!res.ok) throw new Error("Delete failed");

    showToast("Furniture deleted ✅", "t-warning");

    addLog(
      "DELETE",
      "FURNITURE",
      `Deleted furniture: ${deleteFurName}`,
      deleteFurName
    );

    closeM("m-confirm-fur-del");
    closeDP();
    renderFurniture();
  })
  .catch(err => console.error(err));
}


async function loadFurLocations() {
  const res = await fetch(`${API_URL}/api/location`);
  const data = await res.json();

  const select = document.getElementById("fur-f-loc");
  select.innerHTML = "";

  data.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc.location_id;
    opt.textContent = loc.location_name;
    select.appendChild(opt);
  });
}

function openAddFurniture() {
  furEditId = null;
  openM('m-add-fur');
  loadFurLocations();
}



















/* ──────────────────────────────────────────────────────────────
   IT SUPPLIES
────────────────────────────────────────────────────────────── */

async function renderITSupplies() {
  const res = await fetch(`${API_URL}/api/it-supplies`);
  const data = await res.json();

  const tbody = document.getElementById("it-tbody");
  tbody.innerHTML = "";

  data.forEach(it => {
    const tr = document.createElement("tr");

    tr.className = "tr-clickable";

    const today = new Date();
    let warrantyStatus = "OK";

    if (it.warranty_end_date) {
      const w = new Date(it.warranty_end_date);
      const diffDays = (w - today) / (1000 * 60 * 60 * 24);

      if (w < today) {
        warrantyStatus = "EXPIRED";
      } else if (diffDays < 30) {
        warrantyStatus = "EXPIRING";
      }
    }

    tr.innerHTML = `
      <td>${it.asset_name}</td>
      <td>${it.serial_number || '-'}</td>
      <td>${it.quantity}</td>
      <td>
        ${it.warranty_end_date || '-'} <br/>
        ${
          warrantyStatus === "EXPIRED"
            ? '<span class="badge b-red">Expired</span>'
            : warrantyStatus === "EXPIRING"
            ? '<span class="badge b-amber">Soon</span>'
            : '<span class="badge b-green">OK</span>'
        }
      </td>
      <td>${it.location_name || '-'}</td>
      <td>${it.status || '-'}</td>
      <td>
        <button onclick="event.stopPropagation(); editIT(${it.it_supplies_id})">✏️</button>
        <button onclick="event.stopPropagation(); deleteIT(${it.it_supplies_id}, '${it.asset_name}')">🗑️</button>
      </td>
    `;

    tr.addEventListener("click", () => {
      openDP("itsupplies", it.it_supplies_id, tr);
    });

    tbody.appendChild(tr);
  });
}

async function dpITSupplies(id) {
  const res = await fetch(`${API_URL}/api/it-supplies`);
  const data = await res.json();

  const it = data.find(x => x.it_supplies_id === id);
  if (!it) return;

  setDPHeader('🖨️', '#eef2ff', it.asset_name, 'IT Supply');

  const today = new Date();
  let warrantyStatus = "OK";

  if (it.warranty_end_date) {
    const w = new Date(it.warranty_end_date);
    const diffDays = (w - today) / (1000 * 60 * 60 * 24);

    if (w < today) {
      warrantyStatus = "EXPIRED";
    } else if (diffDays < 30) {
      warrantyStatus = "EXPIRING";
    }
  }

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">📦 Supply Details</div>
      <div class="dp-grid">
        ${dpField("Asset Name", it.asset_name)}
        ${dpField("Serial / Model", it.serial_number || '-')}
        ${dpField("Quantity", it.quantity)}
        ${dpField("Date Purchased", it.date_of_purchase || '-')}
        ${dpField("Warranty",
          (it.warranty_end_date || '-') + " (" + warrantyStatus + ")"
        )}
        ${dpField("Price", it.price ? '₱' + it.price : '-')}
        ${dpField("Location", it.location_name || '-')}
        ${dpField("Status", it.status || '-')}
        ${dpField("Remarks", it.remarks || '-')}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm"
          onclick="editIT(${it.it_supplies_id})">
          ✏️ Edit
        </button>

        <button class="btn btn-red btn-sm"
          onclick="deleteIT(${it.it_supplies_id}, '${it.asset_name}')">
          🗑️ Delete
        </button>
      </div>
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}

let itEditId = null;

function saveITSupply() {
  const name = document.getElementById("it-f-name").value;
  const serial = document.getElementById("it-f-serial").value;
  const qty = document.getElementById("it-f-qty").value;
  const date = document.getElementById("it-f-date").value;
  const price = document.getElementById("it-f-price").value;
  const warranty = document.getElementById("it-f-warranty").value;
  const loc = document.getElementById("it-f-loc").value;
  const status = document.getElementById("it-f-status").value;
  const remarks = document.getElementById("it-f-remarks").value;

  if (!name || !qty || !loc) {
    showToast("Fill required fields", "t-error");
    return;
  }

  const payload = {
    asset_name: name,
    serial_number: serial,
    quantity: qty,
    date_of_purchase: date,
    price,
    warranty_end_date: warranty,
    location_id: loc,
    status,
    remarks
  };

  const url = itEditId
    ? `${API_URL}/api/it-supplies/${itEditId}`
    : `${API_URL}/api/it-supplies`;

  const method = itEditId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error("Failed");

    showToast(itEditId ? "Updated IT Supply" : "Added IT Supply", "t-success");

    addLog(
      itEditId ? "UPDATE" : "CREATE",
      "IT SUPPLY",
      `${itEditId ? "Updated IT Supply" : "Added IT Supply"} ${name}`,
      name
    );

  itEditId = null;
  closeM("m-add-it");
  renderITSupplies();

  // ✅ REFRESH DETAIL PANEL (NO CLOSE)
  if (dpCurrentType === "itsupplies") {
    dpITSupplies(dpCurrentId);
  }
  });
}

async function editIT(id) {
  const res = await fetch(`${API_URL}/api/it-supplies`);
  const data = await res.json();

  const it = data.find(x => x.it_supplies_id === id);
  if (!it) return;

  itEditId = id;

  openM("m-add-it");
  await loadITLocations();

  document.getElementById("it-f-name").value = it.asset_name;
  document.getElementById("it-f-serial").value = it.serial_number || "";
  document.getElementById("it-f-qty").value = it.quantity;

  let dateVal = "";
  if (it.date_of_purchase) {
    dateVal = new Date(it.date_of_purchase).toISOString().split("T")[0];
  }
  document.getElementById("it-f-date").value = dateVal;

  document.getElementById("it-f-price").value = it.price || "";

  let warrantyVal = "";
  if (it.warranty_end_date) {
    warrantyVal = new Date(it.warranty_end_date).toISOString().split("T")[0];
  }
  document.getElementById("it-f-warranty").value = warrantyVal;

  document.getElementById("it-f-loc").value = it.location_id;
  document.getElementById("it-f-status").value = it.status || "AVAILABLE";
  document.getElementById("it-f-remarks").value = it.remarks || "";
}
``

let deleteITId = null;
let deleteITName = "";

function deleteIT(id, name) {
  deleteITId = id;
  deleteITName = name;

  openM("m-confirm-it-del"); // (make modal later)
}

function confirmDeleteIT() {
  fetch(`${API_URL}/api/it-supplies/${deleteITId}`, {
    method: "DELETE"
  })
  .then(res => {
    if (!res.ok) throw new Error("Delete failed");

    showToast("IT Supply deleted ✅", "t-warning");

    addLog(
      "DELETE",
      "IT SUPPLY",
      `Deleted IT Supply: ${deleteITName}`,
      deleteITName
    );

    closeM("m-confirm-it-del");
    closeDP();
    renderITSupplies();
  })
  .catch(err => console.error(err));
}


async function loadITLocations() {
  const res = await fetch(`${API_URL}/api/location`);
  const data = await res.json();

  const select = document.getElementById("it-f-loc");
  select.innerHTML = "";

  data.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc.location_id;
    opt.textContent = loc.location_name;
    select.appendChild(opt);
  });
}

function openAddIT() {
  itEditId = null;
  openM("m-add-it");
  loadITLocations();
}















/* ──────────────────────────────────────────────────────────────
   LAPTOPS
────────────────────────────────────────────────────────────── */

async function renderLaptops() {
  const res = await fetch(`${API_URL}/api/laptops`);
  const data = await res.json();

  const tbody = document.getElementById('lp-tbody');
  tbody.innerHTML = '';

  data.forEach(lp => {

    const sCls = {
      Active: 'b-green',
      'For Repair': 'b-red',
      Disposed: 'b-slate'
    }[lp.status] || 'b-slate';

    const tr = document.createElement('tr');
    tr.className = 'tr-clickable';

    tr.innerHTML = `
      <td>${lp.asset_number}</td>
      <td>${lp.item_description}</td>
      <td>${lp.current_user_id || '—'}</td>
      <td>${badge(lp.status, sCls)}</td>
      <td>${lp.warranty_end_date || '-'}</td>
      <td>-</td>
      <td>
        <button onclick="event.stopPropagation(); deleteLaptop(${lp.laptop_id})">🗑️</button>
      </td>
    `;

    tr.addEventListener("click", () => {
      openDP("laptop", lp.laptop_id, tr);
    });

    tbody.appendChild(tr);
  });
}

async function dpLaptop(id) {
  const res = await fetch(`${API_URL}/api/laptops`);
  const data = await res.json();
  const histRes = await fetch(`${API_URL}/api/laptops/${id}/history`);
  let history = [];

  try {
    history = await histRes.json();
  } catch (e) {
    console.error("History load failed", e);
  }

  const lp = data.find(x => x.laptop_id === id);
  if (!lp) return;

  const sCls = {
    Active: 'b-green',
    'For Repair': 'b-red',
    Disposed: 'b-slate'
  }[lp.status] || 'b-slate';

  setDPHeader('💻', '#f0fdf4', lp.item_description, lp.asset_number);

  let histHTML = "";

  if (history.length) {
    histHTML = `
      <ul class="mh-list">
        ${history.map(h => `
          <li class="mh-item">
            <div class="mh-dot good"></div>

            <div>
              <div class="mh-cond info">
                ${h.previous_user_name || '—'} → ${h.new_user_name || '—'}
              </div>

              <div class="mh-date">
                ${new Date(h.date_changed).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>

              <div class="mh-remarks">
                ${h.remarks || 'User assignment update'}
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  } else {
    histHTML = `
      <div style="text-align:center;padding:16px;color:var(--slate-400);font-size:12px">
        No assignment history yet.
      </div>
    `;
  }

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">💻 Device Info</div>
      <div class="dp-grid">
        ${dpField("Asset", lp.asset_number)}
        ${dpField("Description", lp.item_description)}
        ${dpField("Serial", lp.serial_number || '-')}
        ${dpField("Category", lp.category)}
        ${dpField("Price", lp.price ? '₱' + lp.price : '-')}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📅 Dates</div>
      <div class="dp-grid">
        ${dpField("Purchased", lp.date_of_purchase || '-')}
        ${dpField("Warranty", lp.warranty_end_date || '-')}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">👤 Assignment</div>
      <div class="dp-grid">
        ${dpField("Assigned To", lp.user_name || "Unassigned")}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📜 Assignment History</div>

      ${histHTML}
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>

      <div class="dp-action-row">

        <button 
          class="btn btn-green btn-sm"
          onclick="openAssign(${lp.laptop_id})">
          👤 Assign User
        </button>

        <button 
          class="btn btn-primary btn-sm"
          onclick="openMaint(${lp.laptop_id})">
          🔧 Maintenance
        </button>

        <button 
          class="btn btn-red btn-sm"
          onclick="deleteLaptop(${lp.laptop_id})">
          🗑️ Delete
        </button>

      </div>
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}

function saveLaptop() {
  const desc = document.getElementById('lp-f-desc').value;
  if (!desc) return;

  const payload = {
    asset_number: document.getElementById('lp-f-asset').value,
    item_description: desc,
    serial_number: document.getElementById('lp-f-serial').value,
    category: document.getElementById('lp-f-brand').value,
    price: document.getElementById('lp-f-price').value,
    current_user_id: null, 
    current_location: document.getElementById('lp-f-location').value || null,
    status: document.getElementById('lp-f-status').value,
    warranty_end_date: document.getElementById('lp-f-warranty').value,
    date_of_purchase: document.getElementById('lp-f-bought').value
  };

  fetch(`${API_URL}/api/laptops`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(() => {
    closeM('m-add-lp');
    renderLaptops();
    showToast("Laptop added", "t-success");
  });
}

async function openAssign(id) {
  currentLpId = id;

  document.getElementById('assign-lp-name').textContent = "Laptop ID: " + id;
  document.getElementById('assign-user').value = '';

  openM('m-assign');
}

function doAssign() {
  const userName = document.getElementById("assign-user").value;

  const user_id = userMap[userName]; 

  fetch(`${API_URL}/api/laptops/${currentLpId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_user_id: user_id
    })
  })
  .then(() => {
    showToast("Laptop Assigned", "t-success");

    addLog(
      "UPDATE",
      "LAPTOP",
      "Assigned laptop to " + userName,
      currentLpId
    );

    closeM('m-assign');
    renderLaptops();

    if (dpOpen && dpCurrentType === "laptop") {
      dpLaptop(dpCurrentId);
    }
  });
}

function openMaint(id) {
  currentLpId = id;

  document.getElementById('maint-name').textContent = "Laptop ID: " + id;
  document.getElementById('maint-sn').textContent = "-";
  document.getElementById('maint-date').value = todayStr();
  document.getElementById('maint-cond').value = 'GOOD';
  document.getElementById('maint-remarks').value = '';

  openM('m-maint');
}

function saveMaintenance() {
  const cond = document.getElementById('maint-cond').value;
  const date = document.getElementById('maint-date').value;
  const remarks = document.getElementById('maint-remarks').value;

  fetch(`${API_URL}/api/laptopMaintenance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      laptop_id: currentLpId,
      check_date: date,
      condition: cond,
      remarks,
      user_id: currentUser.id
    })
  })
  .then(() => {
    showToast("Laptop Maintenance saved", "t-success");

    closeM('m-maint');
    renderLaptops();
  });
}

let deleteLaptopId = null;

function deleteLaptop(id) {
  deleteLaptopId = id;
  openM("m-confirm-lp-del");
}

function confirmDeleteLaptop() {
  fetch(`${API_URL}/api/laptops/${deleteLaptopId}`, {
    method: "DELETE"
  })
  .then(() => {
    showToast("Laptop Deleted", "t-warning");

    addLog("DELETE", "LAPTOP", "Deleted laptop", currentUser.name);

    closeM("m-confirm-lp-del");
    closeDP();
    renderLaptops();
  });
}


async function loadLocationsDropdown() {
  const res = await fetch(`${API_URL}/api/location`);
  const data = await res.json();

  const select = document.getElementById("lp-f-location");
  select.innerHTML = '<option value="">Select Location</option>';

  data.forEach(loc => {
    select.innerHTML += `<option value="${loc.location_id}">${loc.location_name}</option>`;
  });
}

function openAddLaptop() {
  openM("m-add-lp");
  loadLocationsDropdown();
}

let userMap = {};

async function loadAssignUsers() {
  const res = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();

  const names = users.map(u => u.name);

  makeSearchable("assign-user", "assign-user-list", names);

  userMap = {};
  users.forEach(u => {
    userMap[u.name] = u.user_id;
  });
}

async function openAssign(id) {
  currentLpId = id;

  document.getElementById('assign-user').value = "";

  openM('m-assign');
  await loadAssignUsers();
}














/* ──────────────────────────────────────────────────────────────
   PURCHASE ORDERS
────────────────────────────────────────────────────────────── */

async function renderOrders() {
  const res = await fetch(`${API_URL}/api/po`);
  const data = await res.json();

  const tbody = document.getElementById('po-tbody');
  tbody.innerHTML = '';

  data.forEach(o => {
    const tr = document.createElement('tr');

    tr.className = 'tr-clickable';

    // ✅ DEFINE STATUS FIRST
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let status = o.status;

    // ✅ DO NOT override if final states
    if (
      status !== "DELIVERED" &&
      status !== "CANCELLED" && 
      o.expected_delivery_date
    ) {
      const eta = new Date(o.expected_delivery_date);
      const etaDate = new Date(eta.getFullYear(), eta.getMonth(), eta.getDate());

      if (etaDate < today) {
        status = "DELAYED";
      }
    }
    


    // ✅ THEN USE IT
    tr.innerHTML = `
      <td>${o.purchase_order_id}</td>
      <td>${o.item_id}</td>
      <td>${o.item_name || '-'}</td>
      <td>${o.quantity_ordered}</td>
      <td>${o.order_date || ''}</td>
      <td>${o.expected_delivery_date || ''}</td>
      <td>${status}</td>
    `;

    tr.addEventListener('click', () => {
      openDP('order', o.purchase_order_id, tr);
    });

    tbody.appendChild(tr);
  });
}

async function dpOrder(id) {
  const res = await fetch(`${API_URL}/api/po`);
  const data = await res.json();

  const o = data.find(x => x.purchase_order_id === id);
  if (!o) return;

  // ✅ HEADER
  setDPHeader('🛒', '#eff6ff', `PO #${o.purchase_order_id}`, "Purchase Order");

  // ✅ CONTENT
  let html = `
    <div class="dp-section">
      <div class="dp-section-hd">📦 Order Information</div>
      <div class="dp-grid">
        ${dpField('Item ID', o.item_id)}
        ${dpField('Item Name', o.item_name || '-')}
        ${dpField('Quantity', o.quantity_ordered + ' ' + (o.unit || ''))}
        ${dpField('Status', o.status)}
        ${dpField('Order Date', o.order_date)}
        ${dpField('Expected Delivery', o.expected_delivery_date || '—')}
        ${dpField('Delivered', o.actual_delivery_date || 'Pending')}
      </div>
    </div>
  `;

  // ✅ ACTION BUTTON
if (
  (o.status === "ORDERED" || o.status === "DELAYED") && currentUser.role === "admin"
) {
    html += `
      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
          <button class="btn btn-green btn-sm"
            onclick="event.stopPropagation(); markDelivered(${o.purchase_order_id})">
            ✅ Mark Delivered
          </button>      
          <button class="btn btn-red btn-sm"
            onclick="event.stopPropagation(); cancelOrder(${o.purchase_order_id})">
            ❌ Cancel Order
          </button>
        </div>
      </div>
    `;
  }
  

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}


function savePO() {
  const qty   = parseInt(document.getElementById("po-f-qty").value) || 1;
  const unit  = document.getElementById("po-f-unit").value;
  const date  = document.getElementById("po-f-date").value;
  const eta   = document.getElementById("po-f-eta").value;
  const notes = document.getElementById("po-f-notes").value;

  if (!selectState["po-f-performed"]) {
    showToast("Select a valid user", "t-error");
    return;
  }

  fetch(`${API_URL}/api/po`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      item_id: currentOrderItemId, 
      quantity: qty,
      order_date: date,
      expected_delivery_date: eta,
      remarks: notes,
      unit,

      user_id: currentUser.user_id,
      performed_by: document.getElementById("po-f-performed").value
    })
  })
  .then(() => {
    showToast("Purchase order created", "t-success");
    closeM("m-add-po");
    renderOrders();
    renderPO();
    renderInventory(); 
  });
}

async function markDelivered(id) {
  const o = poItems.find(x => x.id === id);
  if (!o) return;
  o.status    = 'DELIVERED';
  o.delivered = todayStr();
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();
  // Auto-update inventory if item matches
  const invMatch = items.find(i => i.name.toLowerCase() === o.item.toLowerCase() && i.cat === o.cat);
  let invMsg = '';
  if (invMatch) {
    invMsg = ` Inventory updated: "${invMatch.name}" +${o.qty} ${o.unit} (now ${invMatch.qty}).`;
    renderInventory();
  }

  addLog('DELIVER','Purchase Orders',`PO Delivered: "${o.item}" x${o.qty} from ${o.supplier}.${invMsg}`,o.poNum);
  renderOrders();
  if (dpOpen && dpCurrentType==='order' && dpCurrentId===o.id) dpOrder(o.id);
  showToast(`Delivered: ${o.item}! ${invMsg}`,'t-success');
}

function deletePO(id) {
  const o = poItems.find(x => x.id === id);
  if (!o || !confirm(`Delete ${o.poNum}?`)) return;
  poItems = poItems.filter(x => x.id !== id);
  addLog('DELETE','Purchase Orders',`Deleted PO: ${o.poNum} — "${o.item}"`,o.poNum);
  closeDP(); 
  renderOrders(); 
  showToast('PO deleted','t-warning');
}

function markDelivered(id) {
  fetch(`${API_URL}/api/po/deliver/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: currentUser.user_id,
      performed_by: currentUser.name,
      role: currentUser.role
    })
  })
  .then(() => {
    showToast("Delivery confirmed", "t-success");
    renderOrders();
    renderInventory();
    closeDP();
  });
}

function cancelOrder(id) {
  fetch(`${API_URL}/api/po/cancel/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: currentUser.user_id,
      performed_by: currentUser.name,
      role: currentUser.role
    })
  })
  .then(() => {
    showToast("Order cancelled", "t-warning");
    renderOrders();
    renderInventory();
    closeDP();
  });
}
















/* ──────────────────────────────────────────────────────────────
   VEHICLES
────────────────────────────────────────────────────────────── */

let currentDisplayedKM = 0;

async function renderVehicles() {
  const res = await fetch(`${API_URL}/api/vehicle`);
  const data = await res.json();

  const tbody = document.getElementById('veh-tbody');
  tbody.innerHTML = '';

  data.forEach(v => {
    const tr = document.createElement('tr');

    // ✅ compute inside loop
    const kmUsed = (v.odometer || 0) - (v.last_maintenance_km || 0);
    const needsMaint = v.status !== "UNDER_MAINTENANCE" && kmUsed >= (v.maintenance_threshold || 1000);

    // ✅ apply highlight
    if (needsMaint) {
      tr.classList.add("tr-warn");
    }

    tr.className += ' tr-clickable';

    tr.innerHTML = `
      <td>${v.vehicle_name}</td>
      <td>${v.type}</td>
      <td>${v.plate_number}</td>

      <td>
        ${
          v.status === "UNDER_MAINTENANCE"
            ? '<span class="badge b-amber">🛠 Under Maintenance</span>'
            : needsMaint
              ? '<span class="badge b-red">⚠️ Needs Maintenance</span>'
              : v.status
        }
      </td>

      <td>${v.odometer || 0} km</td>
      <td>${v.purchase_date || '-'}</td>
    `;

    tr.addEventListener('click', () => {
      openDP('vehicle', v.vehicle_id, tr);
    });

    tbody.appendChild(tr);
  });

  document.getElementById('veh-ct').textContent =
    data.length + " vehicles";
}

function saveVehicle() {
  const name = document.getElementById("veh-f-name").value;
  const type = document.getElementById("veh-f-type").value;
  const plate = document.getElementById("veh-f-plate").value;
  const status = "ACTIVE";
  const date = document.getElementById("veh-f-date").value;
  const price = document.getElementById("veh-f-price").value;
  const remarks = document.getElementById("veh-f-remarks").value;
  const odometer = document.getElementById("veh-f-odometer").value || 0;
  let threshold = 1000;
  if (type === "Motorcycle") threshold = 1500;
  if (type === "Car") threshold = 5000;
  if (type === "Van") threshold = 8000;
  if (type === "Truck") threshold = 10000;

  // Prevent Invalid Inputs
  if (!name || !plate || !type || !price || !date) {
    showToast("Please fill all required fields", "t-error");
    return;
  }
  if (odometer < 0) {
    showToast("Odometer cannot be negative", "t-error");
    return;
  }

  fetch(`${API_URL}/api/vehicle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      vehicle_name: name,
      plate_number: plate,
      type,
      purchase_date: date,
      status,
      price,
      remarks,
      odometer,
      last_maintenance_km: 0, 
      maintenance_threshold: threshold
    })

  })
  .then(res => {
    if (!res.ok) throw new Error("Failed to save");
    return res.text();
  })
  .then(() => {
    showToast("Vehicle added", "t-success");
    closeM("m-add-veh");
    renderVehicles();
  })
  .then(() => {
    showToast("Vehicle added", "t-success");

    addLog(
      "CREATE",
      "Vehicle",
      `Added vehicle: "${name}" (Plate No. ${plate})`,
      "VEH-" + plate
    );

    closeM("m-add-veh");
    renderVehicles();
  })
    .catch(err => {
    console.error(err);
    showToast("Error saving vehicle", "t-error");
  });
  
}

let currentVehId = null;
let currentVehPlate = null;

function openVehMaint(id, currentKM, plate) {
  currentVehId = id;
  currentVehPlate = plate;

  document.getElementById("veh-maint-name").textContent = "Vehicle #" + id;

  document.getElementById("vm-date").value = "";
  document.getElementById("vm-cost").value = "";
  document.getElementById("vm-remarks").value = "";

  // ✅ placeholder + value
  const odoInput = document.getElementById("vm-odo");
  odoInput.value = currentKM || 0;
  odoInput.placeholder = currentKM + " km";

  openM("m-veh-maint");
}

async function dpVehicle(id) {
  const res = await fetch(`${API_URL}/api/vehicle`);
  const data = await res.json();
  const v = data.find(x => x.vehicle_id === id);
  if (!v) return;

  // ✅ MOVE HERE (AFTER v is defined)
  const kmUsed = (v.odometer || 0) - (v.last_maintenance_km || 0);
  const threshold = v.maintenance_threshold || 1000;
  const percent = Math.min(100, Math.round((kmUsed / threshold) * 100));

  // ✅ fetch maintenance FIRST
  const maintRes = await fetch(`${API_URL}/api/vehicle/maintenance/${id}`);
  const maintData = await maintRes.json();

  let maintHTML = '';

  if (maintData.length === 0) {
    maintHTML = `<div class="td-muted">No maintenance records</div>`;
  } else {
  maintHTML = maintData.map(m => `
    <div class="card" style="margin-bottom:10px">
      <div class="card-hd">
        <div class="card-title">🔧 ${m.service_type}</div>
        <span class="badge b-slate">${m.maintenance_date}</span>
      </div>

      <div class="dp-grid">
        ${dpField("Odometer", m.odometer + " km")}
        ${dpField("Cost", "₱ " + m.maintenance_cost)}
      </div>

      ${m.remarks ? `
        <div style="margin:8px; font-size:12px; color:#64748b">
          📝 ${m.remarks}
        </div>
      ` : ""}
    </div>
  `).join('');
  }

  // ✅ NOW build HTML (after maintHTML is ready)
  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">Vehicle Info</div>
      <div class="dp-grid">
        ${dpField("Plate Number", v.plate_number)}
        ${dpField("Type", v.type)}
        ${dpField("Status", v.status)}
        ${dpField("Odometer", (v.odometer || 0) + " km")}
        ${dpField("Last Maintenance KM", (v.last_maintenance_km || 0) + " km")}
        ${dpField("Maintenance Limit", v.maintenance_threshold + " km")}
        ${dpField("Purchase Date", v.purchase_date || '-')}
        ${dpField("Price", v.price || '-')}
        ${dpField("Remarks", v.remarks || '-')}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📊 Maintenance Usage</div>

      <div class="prog-bar-wrap">
        <div class="prog-bar-labels">
          <span>Usage</span>
          <span>${kmUsed} / ${threshold} km</span>
        </div>

        <div class="prog-bar-track">
          <div class="prog-bar-fill"
            style="
              width: ${percent}%;
              background: ${
                percent >= 100
                  ? '#ef4444'   // RED
                  : percent >= 70
                    ? '#f59e0b' // ORANGE
                    : '#22c55e' // GREEN
              };
            ">
          </div>
        </div>
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-action-row">
          ${
            v.status !== "UNDER_MAINTENANCE"
              ? `<button class="btn btn-primary btn-sm"
                  onclick="openVehMaint(${v.vehicle_id}, ${v.odometer}, '${v.plate_number}')">
                  🔧 Place Under Maintenance
                </button>           
                <button class="btn btn-outline btn-sm"
                  onclick="openUpdateOdo(${v.vehicle_id}, ${v.odometer}, '${v.plate_number}')">
                  📊 Update Odometer
                </button>
                `
              : `<button class="btn btn-green btn-sm"
                  onclick="completeMaintenance(${v.vehicle_id}, ${v.odometer}, '${v.plate_number}')">
                  ✅ Complete Maintenance
                </button>`
          }
          <button class="btn btn-red btn-sm"
            onclick="deleteVehicle(${v.vehicle_id}, '${v.plate_number}')">
            🗑️ Delete Vehicle
          </button>
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">🔧 Maintenance History</div>
      ${maintHTML}
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}


function completeMaintenance(id, currentKM, plate) {
  fetch(`${API_URL}/api/vehicle/complete-maint/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      odometer: currentKM
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("Failed");

    showToast("Maintenance completed ✅", "t-success");

    addLog(
      "UPDATE",
      "VEHICLE",
      `Maintenance completed at ${currentKM} km (Plate No. ${plate})`,
      "VEH-" + plate
    );

    renderVehicles();
    dpVehicle(id);
  })
  .catch(err => console.error(err));
}

function saveVehicleMaint() {
  const date = document.getElementById("vm-date").value;
  const odo = document.getElementById("vm-odo").value;
  const type = document.getElementById("vm-type").value;
  const cost = document.getElementById("vm-cost").value;
  const remarks = document.getElementById("vm-remarks").value;

  if (!date || !odo || !type || !cost) {
    showToast("Complete required fields", "t-error");
    return;
  }

  if (odo < 0) {
    showToast("Invalid odometer", "t-error");
    return;
  }

  fetch(`${API_URL}/api/vehicle/maintenance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vehicle_id: currentVehId,
      maintenance_date: date,
      service_type: type,
      maintenance_cost: cost,
      odometer: odo,
      remarks
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("Failed");

    // ✅ update status AFTER SAVE
    return fetch(`${API_URL}/api/vehicle/start-maint/${currentVehId}`, {
      method: "PUT"
    });
  })
  .then(() => {
    showToast("Maintenance saved ✅", "t-success");

    addLog(
      "UPDATE",
      "VEHICLE",
      `Maintenance added (${type}) - ${odo} km (Plate No. ${currentVehPlate})`,
      "VEH-" + currentVehPlate
    );

    closeM("m-veh-maint");
    renderVehicles();
    dpVehicle(currentVehId);
  })
  .catch(err => {
    console.error(err);
    showToast("Error saving maintenance ❌", "t-error");
  });
}

function checkMonthlyOdoReminder() {
  const today = new Date();
  const day = today.getDate();
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat

  // ✅ first working day logic
  const isWorkingDay = dayOfWeek !== 0 && dayOfWeek !== 6;

  if (day <= 3 && isWorkingDay) {
    showToast("📊 Monthly Odometer Update Required", "t-warning");
  }
}

let odoVehId = null;

function openUpdateOdo(id, km, plate) {
  odoVehId = id;
  odoVehPlate = plate;
  currentDisplayedKM = km;

  document.getElementById("uo-km").value = km;
  openM("m-update-odo");
}

let odoVehPlate = null;
function saveOdoUpdate() {
  const km = document.getElementById("uo-km").value;

  if (km < currentDisplayedKM) {
    showToast("Odometer cannot decrease", "t-error");
    return;
  }

  fetch(`${API_URL}/api/vehicle/update-odo/${odoVehId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ odometer: km })
  })
  .then(res => {
    if (!res.ok) throw new Error("Failed");

    showToast("Odometer updated ✅", "t-success");

    addLog(
      "UPDATE",
      "VEHICLE",
      `Updated odometer to ${km} km (Plate No. ${odoVehPlate})`,
      "VEH-" + odoVehPlate
    );

    closeM("m-update-odo");
    renderVehicles();
    dpVehicle(odoVehId);
  })
  .catch(err => console.error(err));
}


let deleteVehId = null;
let deleteVehPlate = null;

function deleteVehicle(id, plate) {
  deleteVehId = id;
  deleteVehPlate = plate;

  openM("m-confirm-del");
}

function confirmDeleteVehicle() {
  fetch(`${API_URL}/api/vehicle/${deleteVehId}`, {
    method: "DELETE"
  })
  .then(res => {
    if (!res.ok) throw new Error("Delete failed");

    showToast("Vehicle deleted ✅", "t-warning");

    closeM("m-confirm-del");
    closeDP();

    renderVehicles();
  })
  .then(() => {
    showToast("Vehicle deleted ✅", "t-warning");

    addLog(
      "DELETE",
      "VEHICLE",
      `Deleted Vehicle (Plate No. ${deleteVehPlate})`,
      "VEH-" + deleteVehPlate
    );

    closeM("m-confirm-del");
    closeDP();
    renderVehicles();
  })
  .catch(err => {
    console.error(err);
    showToast("Error deleting ❌", "t-error");
  });
}













/* ──────────────────────────────────────────────────────────────
   GLOBE MOBILE PLANS
────────────────────────────────────────────────────────────── */

async function renderGlobe() {
  const res = await fetch(`${API_URL}/api/globe`);
  const data = await res.json();

  const tbody = document.getElementById('globe-tbody');
  tbody.innerHTML = '';

  let renewSoon = 0;
  const today = new Date();

  data.forEach(g => {
    const renewDate = new Date(g.renewal_date);
    const diffDays = (renewDate - today) / (1000 * 60 * 60 * 24);

    if (diffDays <= 30 && g.status !== 'Inactive') {
      renewSoon++;
    }

    const sCls =
      g.status === 'Active' ? 'b-green' :
      g.status === 'For Renewal' ? 'b-red' :
      'b-slate';

    const tr = document.createElement('tr');
    tr.className = 'tr-clickable';

    tr.innerHTML = `
      <td>${g.employee_name}</td>
      <td>${g.mobile_number || '-'}</td>
      <td>${g.plan_name || '-'}</td>
      <td>₱${g.monthly_cost || 0}</td>
      <td>${g.renewal_date || '-'}</td>
      <td>${badge(g.status, sCls)}</td>
      <td>
        <button onclick="event.stopPropagation(); editGlobe(${g.plan_id})">✏️</button>
        <button onclick="event.stopPropagation(); deleteGlobe(${g.plan_id})">🗑️</button>
      </td>
    `;

    tr.addEventListener('click', () => {
      openDP('globe', g.plan_id, tr);
    });

    tbody.appendChild(tr);
  });

  document.getElementById('globe-ct').textContent = `${data.length} plans`;
  document.getElementById('globe-renew-ct').textContent = `${renewSoon} renewing soon`;
}


async function dpGlobe(id) {
  const res = await fetch(`${API_URL}/api/globe`);
  const data = await res.json();

  const g = data.find(x => x.plan_id === id);
  if (!g) return;

  const sCls =
    g.status === 'Active' ? 'b-green' :
    g.status === 'For Renewal' ? 'b-red' :
    'b-slate';

  setDPHeader('📱', '#f0fdf4', g.employee_name, 'Globe Mobile Plan');

  const html = `
    <div class="dp-status-row">
      ${badge(g.status, sCls)}
      <span class="dp-status-label">Plan status</span>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">👤 Subscriber Info</div>
      <div class="dp-grid">
        ${dpField("Employee", g.employee_name)}
        ${dpField("Mobile", g.mobile_number || '-')}
        ${dpField("Account", g.account_number || '-')}
        ${dpField("Status", g.status || 'N/A')} 
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📱 Plan Details</div>
      <div class="dp-grid">
        ${dpField("Plan", g.plan_name || '-')}
        ${dpField("Monthly", g.monthly_cost ? '₱' + g.monthly_cost : '-')}
        ${dpField("Data", g.data_allocation || '-')}
        ${dpField("Credit Limit", g.credit_limit ? '₱' + g.credit_limit : '-')}
        ${dpField("Start Date", g.start_date || '-')}
        ${dpField("Renewal", g.renewal_date || '-')}
      </div>
    </div>

    ${g.remarks ? `
      <div class="dp-section">
        <div class="dp-section-hd">📝 Remarks</div>
        <div class="dp-grid">
          ${dpFieldFull("Notes", g.remarks)}
        </div>
      </div>
    ` : ''}

    <div class="dp-section">
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm"
          onclick="editGlobe(${g.plan_id})">
          ✏️ Edit
        </button>

        <button class="btn btn-red btn-sm"
          onclick="deleteGlobe(${g.plan_id})">
          🗑️ Delete
        </button>
      </div>
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}

let globeEditId = null;

function saveGlobe() {
  const userName = document.getElementById("globe-f-user").value;
  const plan     = document.getElementById("globe-f-plan").value.trim();
  const renew    = document.getElementById("globe-f-renew").value;

  if (!userName || !mobile || !plan || !renew) {
    showToast("Fill required fields", "t-error");
    return;
  }

  if (!selectState["globe-f-user"]) {
    showToast("Select valid user", "t-error");
    return;
  }

  const mobile = document.getElementById("globe-f-num").value.trim();

  // ✅ PH mobile format
  const mobilePattern = /^09\d{2}-\d{3}-\d{4}$/;

  if (mobile && !mobilePattern.test(mobile)) {
    showToast("Invalid mobile format", "t-error");
    return;
  }

  const payload = {
    user_id: globeUserMap[userName],
    mobile_number: document.getElementById('globe-f-num').value,
    account_number: document.getElementById('globe-f-acct').value,
    plan_name: document.getElementById('globe-f-plan').value,
    data_allocation: document.getElementById('globe-f-data').value,
    monthly_cost: document.getElementById('globe-f-cost').value,
    credit_limit: document.getElementById('globe-f-credit').value,
    start_date: document.getElementById('globe-f-start').value,
    renewal_date: document.getElementById('globe-f-renew').value,
    status: document.getElementById('globe-f-status').value, 
    remarks: document.getElementById('globe-f-remarks').value
  };

  const url = globeEditId
    ? `${API_URL}/api/globe/${globeEditId}`
    : `${API_URL}/api/globe`;

  const method = globeEditId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(() => {
    showToast(globeEditId ? "Updated Plan" : "Added Plan", "t-success");

    addLog(
      globeEditId ? "UPDATE" : "CREATE",
      "GLOBE PLAN",
      `${globeEditId ? "Updated" : "Added"} plan for ${userName}`,
      userName
    );

    globeEditId = null;
    closeM("m-add-globe");
    renderGlobe();

    if (dpCurrentType === "globe") {
      dpGlobe(dpCurrentId);
    }
  });
}

async function editGlobe(id) {
  const res = await fetch(`${API_URL}/api/globe`);
  const data = await res.json();

  const g = data.find(x => x.plan_id === id);
  if (!g) return;

  globeEditId = id;

  openM("m-add-globe");
  await loadGlobeUsers();

  document.getElementById("globe-f-user").value = g.employee_name;
  selectState["globe-f-user"] = true;

  document.getElementById("globe-f-num").value = g.mobile_number || "";
  document.getElementById("globe-f-acct").value = g.account_number || "";
  document.getElementById("globe-f-plan").value = g.plan_name || "";
  document.getElementById("globe-f-cost").value = g.monthly_cost || "";
  document.getElementById("globe-f-data").value = g.data_allocation || "";
  document.getElementById("globe-f-renew").value = g.renewal_date || "";
  document.getElementById("globe-f-credit").value = g.credit_limit || "";
  document.getElementById("globe-f-remarks").value = g.remarks || "";
  document.getElementById("globe-f-start").value = g.start_date || "";
  document.getElementById("globe-f-status").value = g.status || "Active"; 
}

let deleteGlobeId = null;

function deleteGlobe(id) {
  deleteGlobeId = id;
  openM("m-confirm-globe-del");
}

function confirmDeleteGlobe() {
  fetch(`${API_URL}/api/globe/${deleteGlobeId}`, {
    method: "DELETE"
  })
  .then(() => {

    addLog(
      "DELETE",
      "GLOBE PLAN",
      "Deleted mobile plan",
      "system"
    );

    showToast("Deleted Plan", "t-warning");

    closeM("m-confirm-globe-del");
    closeDP();
    renderGlobe();
  });
}

let globeUserMap = {};

async function loadGlobeUsers() {
  const res = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();

  const names = users.map(u => u.name);

  makeSearchable("globe-f-user", "globe-f-user-list", names);

  globeUserMap = {};
  users.forEach(u => {
    globeUserMap[u.name] = u.user_id;
  });
}

function openAddGlobe() {
  globeEditId = null;
  openM("m-add-globe");
  loadGlobeUsers();
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("globe-f-num");

  if (!input) return;

  input.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, ""); // numbers only

    if (val.length > 4 && val.length <= 7) {
      val = val.replace(/(\d{4})(\d+)/, "$1-$2");
    } else if (val.length > 7) {
      val = val.replace(/(\d{4})(\d{3})(\d+)/, "$1-$2-$3");
    }

    e.target.value = val;
  });
});















/* ──────────────────────────────────────────────────────────────
   M365 LICENSES
────────────────────────────────────────────────────────────── */

async function renderM365() {
  const res = await fetch(`${API_URL}/api/m365`);
  const data = await res.json();

  const tbody = document.getElementById('m365-tbody');
  tbody.innerHTML = "";

  data.forEach(m => {
    const tr = document.createElement("tr");

    tr.className = "tr-clickable";

    tr.innerHTML = `
      <td>${m.assigned_email}</td>
      <td>${m.license_type}</td>
      <td>${m.category}</td>
      <td>${m.expiry_date || '-'}</td>
      <td>${m.license_cost || '-'}</td>
      <td>${m.status || '-'}</td>
    `;

    tr.addEventListener("click", () => {
      openDP("m365", m.license_id, tr);
    });

    tbody.appendChild(tr);
  });
}

async function dpM365(id) {
  const res = await fetch(`${API_URL}/api/m365`);
  const data = await res.json();

  const m = data.find(x => x.license_id === id);
  if (!m) return;

  setDPHeader('💼', '#f0fdf4', m.assigned_email, 'M365 License');

  const html = `
    <div class="dp-section">
      <div class="dp-section-hd">📧 License Info</div>
      <div class="dp-grid">
        ${dpField("Email", m.assigned_email)}
        ${dpField("Type", m.license_type)}
        ${dpField("Category", m.category)}
        ${dpField("Status", m.status || '-')}
        ${dpField("Cost", m.license_cost ? '₱'+m.license_cost : '-')}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">📅 Dates</div>
      <div class="dp-grid">
        ${dpField("Start Date", m.start_date || '-')}
        ${dpField("Expiry Date", m.expiry_date || '-')}
        ${dpField("Renewal Date", m.renewal_date || '-')}
      </div>
    </div>

    ${m.remarks ? `
      <div class="dp-section">
        <div class="dp-section-hd">📝 Remarks</div>
        <div class="dp-grid">
          ${dpFieldFull("Notes", m.remarks)}
        </div>
      </div>
    ` : ''}

    <div class="dp-section">
      <div class="dp-action-row">
        <button class="btn btn-primary btn-sm"
          onclick="editM365(${m.license_id})">
          ✏️ Edit
        </button>

        <button class="btn btn-red btn-sm"
          onclick="deleteM365(${m.license_id})">
          🗑️ Delete
        </button>
      </div>
    </div>
  `;

  document.getElementById("dp-body").innerHTML = html;
}
let m365EditId = null;

function saveM365() {
  const email = document.getElementById('m365-f-email').value.trim();
  const type = document.getElementById('m365-f-type').value;
  const cat = document.getElementById('m365-f-cat').value;
  const expiry = document.getElementById('m365-f-expiry').value;
  const cost = parseFloat(document.getElementById('m365-f-cost').value) || 0;
  const remarks = document.getElementById('m365-f-remarks').value;
  const start = document.getElementById('m365-f-start').value;
  const renewal = document.getElementById('m365-f-renew').value;

  if (!email || !type || !cost || !expiry || !start || !renewal || !cat) {
    showToast("Fill required fields", "t-error");
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    showToast("Invalid email format", "t-error");
    return;
  }

  const payload = {
    assigned_email: email,
    license_type: type,
    category: cat,
    license_cost: cost,
    start_date: start,
    expiry_date: expiry,
    renewal_date: renewal,
    status: "Active",
    remarks
  };

  const url = m365EditId
    ? `${API_URL}/api/m365/${m365EditId}`
    : `${API_URL}/api/m365`;

  const method = m365EditId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(() => {
    showToast("M365 Saved", "t-success");

    addLog(
      m365EditId ? "UPDATE" : "CREATE",
      "M365 LICENSE",
      `${m365EditId ? "Updated M365 License" : "Added M365 License"} ${email}`,
      email
    );

    m365EditId = null;
    closeM("m-add-m365");
    renderM365();

      
    if (dpCurrentType === "m365") {
      dpM365(dpCurrentId);
    }

  });
}

async function editM365(id) {
  const res = await fetch(`${API_URL}/api/m365`);
  const data = await res.json();

  const m = data.find(x => x.license_id === id);
  if (!m) return;

  m365EditId = id;

  openM("m-add-m365");

  document.getElementById('m365-f-email').value = m.assigned_email;
  document.getElementById('m365-f-type').value = m.license_type;
  document.getElementById('m365-f-cat').value = m.category;

  document.getElementById('m365-f-cost').value = m.license_cost || "";
  document.getElementById('m365-f-remarks').value = m.remarks || "";

  document.getElementById('m365-f-start').value =
    m.start_date ? new Date(m.start_date).toISOString().split("T")[0] : "";

  document.getElementById('m365-f-expiry').value =
    m.expiry_date ? new Date(m.expiry_date).toISOString().split("T")[0] : "";

  document.getElementById('m365-f-renew').value =
    m.renewal_date ? new Date(m.renewal_date).toISOString().split("T")[0] : "";
}

let deleteM365Id = null;

function deleteM365(id) {
  deleteM365Id = id;
  openM("m-confirm-m365-del");
}

function confirmDeleteM365() {
  fetch(`${API_URL}/api/m365/${deleteM365Id}`, {
    method: "DELETE"
  })
  .then(() => {
    showToast("M365 Deleted", "t-warning");

    addLog(
      "DELETE",
      "M365 LICENSE",
      "M365 License Deleted",
      currentUser.name
    );

    closeM("m-confirm-m365-del");
    closeDP();
    renderM365();
  });
}











/* ──────────────────────────────────────────────────────────────
   SYSTEM LOGS
────────────────────────────────────────────────────────────── */
let logs = [];
let logId = 1;

const LOG_ICONS = { LOGIN:'🔐',LOGOUT:'🚪',CREATE:'✅',UPDATE:'✏️',DELETE:'🗑️',DELIVER:'📦',WITHDRAW:'➖',SYSTEM:'⚙️' };

function addLog(action, module, desc, ref='—') {
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
      reference_type: ref
    })
  }).catch(err => console.error("Log error:", err));
}

function dpLog(id) {
  const l = logs.find(x => x.id === id);
  if (!l) return;
  const clsMap = {CREATE:'la-create',UPDATE:'la-update',DELETE:'la-delete',DELIVER:'la-deliver',WITHDRAW:'la-withdraw',LOGIN:'la-system',LOGOUT:'la-system',SYSTEM:'la-system'};
  setDPHeader(LOG_ICONS[l.action]||'📝','#f8fafc', `Log #${l.id}`, l.module);
  document.getElementById('dp-body').innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">📜 Log Entry</div>
      <div class="dp-grid">
        ${dpField('Log ID', `#${l.id}`, 'mono')}
        ${dpField('Timestamp', l.ts, 'mono')}
        ${dpField('User', l.user)}
        ${dpField('Action', `<span class="log-action-badge ${clsMap[l.action]||'la-system'}">${LOG_ICONS[l.action]||'📝'} ${l.action}</span>`)}
        ${dpField('Module', l.module)}
        ${dpField('Reference', l.ref, 'mono')}
        ${dpFieldFull('Description', l.desc)}
      </div>
    </div>`;
  document.getElementById('dp-footer').style.display = 'none';
}

function clearLogs() {
  if (!confirm('Clear all system logs? This cannot be undone.')) return;
  logs = [];
  logId = 1;
  renderLogs();
  showToast('Logs cleared','t-warning');
}















/* ──────────────────────────────────────────────────────────────
   DASHBOARD REFRESH
────────────────────────────────────────────────────────────── */
async function refreshDashboard() {
  // Stats
  const res = await fetch(`${API_URL}/api/inventory`);
  const items = await res.json();
  const lowInv = items.filter(i => i.qty <= i.reorder).length;
  const activeLaptops = laptops.filter(l => l.status === 'Active').length;
  const now = new Date(); now.setHours(0,0,0,0);
  let pending = 0;
  poItems.forEach(o => {
    let s = o.status;
    if (s!=='DELIVERED' && o.eta && new Date(o.eta)<now) s='DELAYED';
    if (['ORDERED','IN TRANSIT','DELAYED'].includes(s)) pending++;
  });

  document.getElementById('dc-total').textContent   = items.length;
  document.getElementById('dc-total-d').textContent = `${items.length} tracked items`;
  document.getElementById('dc-low').textContent     = lowInv;
  document.getElementById('dc-low-d').textContent   = lowInv ? `${lowInv} items need restocking` : 'All stocks OK';
  document.getElementById('dc-laptops').textContent = activeLaptops;
  document.getElementById('dc-laptops-d').textContent = `${activeLaptops} of ${laptops.length} active`;
  document.getElementById('dc-orders').textContent  = pending;
  document.getElementById('dc-orders-d').textContent = pending ? `${pending} pending` : 'No pending orders';

  // Low stock list
  const lowItems = items.filter(i => i.qty <= i.reorder).slice(0,5);
  document.getElementById('dash-low-list').innerHTML = lowItems.length
    ? lowItems.map(i => `<div class="panel-row"><div class="pr-dot ${i.qty===0?'red':'amber'}"></div><div><div class="pr-name">${i.name}</div><div class="pr-meta">${i.cat} · Qty: ${i.qty} / Reorder: ${i.reorder}</div></div>${badge(i.qty===0?'Critical':'Low Stock',i.qty===0?'b-red':'b-amber')}</div>`).join('')
    : `<div style="padding:16px;text-align:center;color:var(--slate-400);font-size:12.5px">✅ All inventory levels are OK</div>`;
  document.getElementById('dash-low-ct').textContent = lowItems.length+' items';

  // Pending orders
  const pendOrd = poItems.filter(o => {
    let s=o.status;
    if(s!=='DELIVERED'&&o.eta&&new Date(o.eta)<now)s='DELAYED';
    return ['ORDERED','IN TRANSIT','DELAYED'].includes(s);
  }).slice(0,5);
  document.getElementById('dash-order-list').innerHTML = pendOrd.length
    ? pendOrd.map(o => {
        let s=o.status; if(s!=='DELIVERED'&&o.eta&&new Date(o.eta)<now)s='DELAYED';
        const dotCls = s==='DELAYED'?'red':s==='IN TRANSIT'?'blue':'amber';
        return `<div class="panel-row"><div class="pr-dot ${dotCls}"></div><div><div class="pr-name">${o.item}</div><div class="pr-meta">${o.poNum} · ETA: ${o.eta||'—'}</div></div>${badge(s,s==='DELAYED'?'b-red':s==='IN TRANSIT'?'b-blue':'b-amber')}</div>`;
      }).join('')
    : `<div style="padding:16px;text-align:center;color:var(--slate-400);font-size:12.5px">📦 No pending orders</div>`;
  document.getElementById('dash-order-ct').textContent = pendOrd.length+' orders';

  // Laptops needing maintenance
  const maintLp = laptops.filter(l => l.maint==='NEEDS REPAIR'||l.status==='For Repair');
  document.getElementById('dash-maint-list').innerHTML = maintLp.length
    ? maintLp.slice(0,4).map(l => `<div class="panel-row"><div class="pr-dot red"></div><div><div class="pr-name">${l.desc}</div><div class="pr-meta">${l.assetNo} · ${l.user}</div></div>${badge('Needs Repair','b-red')}</div>`).join('')
    : `<div style="padding:16px;text-align:center;color:var(--slate-400);font-size:12.5px">✅ No laptops need maintenance</div>`;
  document.getElementById('dash-maint-ct').textContent = maintLp.length+' units';

  // Vehicle alerts
  const vehAlerts = vehicles.filter(v => {
    const nd = v.nextMaint ? new Date(v.nextMaint) : null;
    return nd && nd <= now || v.status==='For Maintenance';
  });
  document.getElementById('dash-veh-list').innerHTML = vehAlerts.length
    ? vehAlerts.slice(0,4).map(v => `<div class="panel-row"><div class="pr-dot amber"></div><div><div class="pr-name">${v.name}</div><div class="pr-meta">${v.plate} · ${v.assigned}</div></div>${badge('Maintenance Due','b-amber')}</div>`).join('')
    : `<div style="padding:16px;text-align:center;color:var(--slate-400);font-size:12.5px">✅ All vehicles on schedule</div>`;
  document.getElementById('dash-veh-ct').textContent = vehAlerts.length+' alerts';

  // Date
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}















/* ──────────────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────────────── */

function autoLogin() {
  const savedUser = localStorage.getItem("user");

  if (!savedUser) return;

  const user = JSON.parse(savedUser);

  currentUser = {
    user_id: user.user_id,
    name: user.name,
    role: user.role,
    initials: user.name.substring(0, 2).toUpperCase()
  };

  // SHOW APP
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');

  buildSidebar();
  initAllModules();

  const savedPage = localStorage.getItem("currentPage");
  if (savedPage) {
    navigate(savedPage);
  }

  // Update UI safely
  if (typeof updateUserUI === "function") {
    updateUserUI();
  }
}

function initAllModules() {
  renderInventory();
  renderFurniture();
  renderITSupplies();
  renderLaptops();
  renderOrders();
  renderVehicles();
  renderGlobe();
  renderM365();
  renderLogs();
  renderUsers();
  renderVehicles()
  loadFurLocations();
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
}















/* ──────────────────────────────────────────────────────────────
   LOGS
────────────────────────────────────────────────────────────── */

async function renderLogs() {
  const res = await fetch(`${API_URL}/api/logs`);
  const logs = await res.json();

  const tbody = document.getElementById("log-tbody");
  tbody.innerHTML = "";

  logs.forEach(log => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${new Date(log.date_time).toLocaleString()}</td>
      <td>${log.name || "Unknown"}</td>
      <td>${log.action_type}</td>
      <td>${log.module}</td>
      <td>${log.description}</td>
      <td>${log.performed_by || "-"}</td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("log-ct").innerText =
    logs.length + " entries";
}

window.onload = function () {
  autoLogin();
};

