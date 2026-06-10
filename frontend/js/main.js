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
let laptops = [
  { id:1, assetNo:'LPT-2024-001', desc:'Dell Latitude 5510',   serial:'DL5510-0023', brand:'Dell',   user:'Juan Reyes',    dept:'IT Department', status:'Active',    warranty:'2025-12-31', price:65000,  bought:'2022-01-15', maint:'NEEDS REPAIR', maintHistory:[{date:'2026-05-10',cond:'NEEDS REPAIR',tech:'IT Team',remarks:'Keyboard W,A,S,D unresponsive. For replacement.'},{date:'2026-03-01',cond:'GOOD',tech:'IT Team',remarks:'Thermal paste replaced. Fan cleaned.'}] },
  { id:2, assetNo:'LPT-2024-002', desc:'HP ProBook 450 G8',    serial:'HP450-0008',  brand:'HP',     user:'Ana Cruz',      dept:'Finance',       status:'For Repair', warranty:'2026-06-30', price:58000,  bought:'2022-03-20', maint:'NEEDS REPAIR', maintHistory:[{date:'2026-05-15',cond:'NEEDS REPAIR',tech:'IT Team',remarks:'Battery bloated, replacement needed.'}] },
  { id:3, assetNo:'LPT-2025-003', desc:'Lenovo ThinkPad E15',  serial:'LEN-E15-0031',brand:'Lenovo', user:'Unassigned',    dept:'IT Department', status:'Active',    warranty:'2027-03-15', price:52000,  bought:'2023-01-10', maint:'For Check',    maintHistory:[] },
  { id:4, assetNo:'LPT-2025-004', desc:'MacBook Air M2 (2023)',serial:'MBA-M2-0012', brand:'Apple',  user:'Carlos Santos', dept:'Executive',     status:'Active',    warranty:'2027-09-01', price:85000,  bought:'2023-08-15', maint:'GOOD',         maintHistory:[{date:'2026-04-20',cond:'GOOD',tech:'IT Team',remarks:'Routine checkup. All systems functional.'}] },
  { id:5, assetNo:'LPT-2023-005', desc:'Acer Aspire 5',        serial:'ACER-A5-0007',brand:'Acer',   user:'Rosa Flores',   dept:'HR',            status:'Active',    warranty:'2024-08-15', price:34000,  bought:'2021-06-01', maint:'GOOD',         maintHistory:[{date:'2026-02-14',cond:'GOOD',tech:'IT Team',remarks:'SSD upgraded to 512GB.'}] },
  { id:6, assetNo:'LPT-2022-006', desc:'ASUS VivoBook 14',     serial:'ASUS-VB14-003',brand:'ASUS',  user:'—',             dept:'—',             status:'Disposed',  warranty:'2023-01-01', price:38000,  bought:'2020-05-15', maint:'—',            maintHistory:[{date:'2023-12-01',cond:'NEEDS REPAIR',tech:'IT Team',remarks:'Motherboard failure. Economically unviable to repair. Disposed.'}] },
];
let lpId = 7;
let currentLpId = null;

function renderLaptops() {
  const isAdmin =
    currentUser.role === 'admin' ||
    currentUser.role === 'super_admin';
  const tbody = document.getElementById('lp-tbody');
  tbody.innerHTML = '';
  let active = 0;
  laptops.forEach(lp => {
    if (lp.status === 'Active') active++;
    const sCls = {Active:'b-green','For Repair':'b-red',Disposed:'b-slate'}[lp.status]||'b-slate';
    const mCls = lp.maint==='GOOD'?'b-green':lp.maint==='NEEDS REPAIR'?'b-red':'b-amber';
    const isRepair = lp.status === 'For Repair';
    const tr = document.createElement('tr');
    tr.className = 'tr-clickable' + (isRepair ? ' tr-warn' : '');
    tr.innerHTML = `
      <td class="td-mono">${lp.assetNo}</td>
      <td class="td-strong">${lp.desc}</td>
      <td>${lp.user}</td>
      <td>${badge(lp.status, sCls)}</td>
      <td class="td-mono">${lp.warranty}</td>
      <td>${lp.maint !== '—' ? badge(lp.maint, mCls) : '<span class="td-muted">—</span>'}</td>
      <td>
        ${isAdmin ? `<div class="flex-gap">
          <button class="btn btn-xs btn-primary" title="Assign User" onclick="event.stopPropagation();openAssign(${lp.id})">👤</button>
          <button class="btn btn-xs btn-outline" title="Maintenance" onclick="event.stopPropagation();openMaint(${lp.id})">🔧</button>
          <button class="btn btn-xs btn-red" title="Delete" onclick="event.stopPropagation();deleteLaptop(${lp.id})">🗑️</button>
        </div>` : '<span class="td-muted">View only</span>'}
      </td>`;
    tr.addEventListener('click', () => openDP('laptop', lp.id, tr));
    tbody.appendChild(tr);
  });
  document.getElementById('lp-ct').textContent    = `${laptops.length} units`;
  document.getElementById('dc-laptops').textContent = active;
  document.getElementById('dc-laptops-d').textContent = `${active} currently active`;
}

function dpLaptop(id) {
  const lp = laptops.find(x => x.id === id);
  if (!lp) return;
  const isAdmin =
    currentUser.role === 'admin' ||
    currentUser.role === 'super_admin';
  const statusColor = {Active:'#f0fdf4','For Repair':'#fef2f2',Disposed:'#f8fafc'}[lp.status]||'#f8fafc';
  const sCls = {Active:'b-green','For Repair':'b-red',Disposed:'b-slate'}[lp.status]||'b-slate';
  const mCls = lp.maint==='GOOD'?'b-green':lp.maint==='NEEDS REPAIR'?'b-red':'b-amber';

  // Lifecycle analysis
  const boughtDate = new Date(lp.bought);
  const ageYears   = Math.floor((new Date() - boughtDate) / (365.25*24*3600*1000));
  const isMac      = lp.brand === 'Apple' && lp.price >= 70000;
  const maxYears   = isMac ? 5 : 3;
  const needsReplace = ageYears >= maxYears;

  setDPHeader('💻', statusColor, lp.desc, lp.assetNo);

  let histHTML = '';
  if (lp.maintHistory && lp.maintHistory.length) {
    histHTML = '<ul class="mh-list">' + lp.maintHistory.slice().reverse().map(m =>
      `<li class="mh-item"><div class="mh-dot ${m.cond==='GOOD'?'good':'repair'}"></div><div><div class="mh-cond ${m.cond==='GOOD'?'good':'repair'}">${m.cond}</div><div class="mh-date">${m.date} · ${m.tech||'IT Team'}</div><div class="mh-remarks">${m.remarks||'—'}</div></div></li>`
    ).join('') + '</ul>';
  } else {
    histHTML = '<div style="text-align:center;padding:16px;color:var(--slate-400);font-size:12px">No maintenance records yet.</div>';
  }

  let html = `
    ${lp.status==='For Repair' ? `<div class="dp-alert danger">🔴 <span class="dp-alert-text">Unit is FOR REPAIR. Check maintenance history below.</span></div>` : ''}
    ${needsReplace ? `<div class="dp-alert warning">⚠️ <span class="dp-alert-text">Laptop is ${ageYears} years old — exceeds ${maxYears}-year replacement threshold${isMac?' (Mac >₱70k policy)':''}.</span></div>` : ''}
    <div class="dp-status-row">${badge(lp.status,sCls)}<span class="dp-status-label">${ageYears} years old · ${isMac?'Mac lifecycle (5yr)':'Standard lifecycle (3yr)'}</span></div>

    <div class="dp-section">
      <div class="dp-section-hd">💻 Device Information</div>
      <div class="dp-grid">
        ${dpFieldFull('Description',`<strong>${lp.desc}</strong>`)}
        ${dpField('Asset Number', lp.assetNo, 'mono')}
        ${dpField('Serial Number', lp.serial, 'mono')}
        ${dpField('Brand', lp.brand)}
        ${dpField('Purchase Price', '₱'+lp.price.toLocaleString())}
        ${dpField('Date Purchased', lp.bought, 'mono')}
        ${dpField('Warranty Expiry', lp.warranty, 'mono')}
        ${dpField('Age', ageYears+' year'+(ageYears!==1?'s':''))}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">👤 Assignment</div>
      <div class="dp-grid">
        ${dpField('Assigned To', lp.user)}
        ${dpField('Department', lp.dept)}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">🔧 Maintenance · ${badge(lp.maint!=='—'?lp.maint:'No Record', lp.maint!=='—'?mCls:'b-slate')}</div>
      <p style="font-size:11.5px;color:var(--slate-400);margin-bottom:10px">Maintenance scheduled every <strong>June & December</strong></p>
      ${histHTML}
    </div>`;

  if (isAdmin) html += `<div class="dp-section"><div class="dp-section-hd">⚡ Actions</div><div class="dp-action-row"><button class="btn btn-green btn-sm" onclick="openAssign(${lp.id})">👤 Assign User</button><button class="btn btn-primary btn-sm" onclick="openMaint(${lp.id})">🔧 Add Maintenance</button><button class="btn btn-red btn-sm" onclick="deleteLaptop(${lp.id})">🗑️ Delete</button></div></div>`;
  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

function saveLaptop() {
  const assetNo = document.getElementById('lp-f-asset').value.trim() || `LPT-${new Date().getFullYear()}-${String(lpId).padStart(3,'0')}`;
  const desc    = document.getElementById('lp-f-desc').value.trim();
  const serial  = document.getElementById('lp-f-serial').value.trim()||'N/A';
  const brand   = document.getElementById('lp-f-brand').value;
  const user    = document.getElementById('lp-f-user').value.trim()||'Unassigned';
  const dept    = document.getElementById('lp-f-dept').value;
  const status  = document.getElementById('lp-f-status').value;
  const warranty= document.getElementById('lp-f-warranty').value||'N/A';
  const price   = parseFloat(document.getElementById('lp-f-price').value)||0;
  const bought  = document.getElementById('lp-f-bought').value||todayStr();
  if (!desc) { showToast('Description required','t-error'); return; }
  laptops.push({ id:lpId++, assetNo,desc,serial,brand,user,dept,status,warranty,price,bought,maint:'For Check',maintHistory:[] });
  closeM('m-add-lp');
  clearForm(['lp-f-asset','lp-f-desc','lp-f-serial','lp-f-user','lp-f-warranty','lp-f-price','lp-f-bought']);
  addLog('CREATE','Laptops',`Added laptop: "${desc}" (SN: ${serial}) → ${user}`,assetNo);
  renderLaptops(); showToast(`"${desc}" added`,'t-success');
}

function openAssign(id) {
  const lp = laptops.find(x => x.id === id);
  if (!lp) return;
  currentLpId = id;
  document.getElementById('assign-lp-name').textContent = lp.desc;
  document.getElementById('assign-user').value = '';
  openM('m-assign');
}

function doAssign() {
  const lp = laptops.find(x => x.id === currentLpId);
  if (!lp) return;
  const name = document.getElementById('assign-user').value.trim();
  const dept = document.getElementById('assign-dept').value;
  if (!name) { showToast('Enter a name','t-error'); return; }
  const old = lp.user;
  lp.user = name; lp.dept = dept;
  closeM('m-assign');
  addLog('UPDATE','Laptops',`Reassigned "${lp.desc}" from ${old} to ${name} (${dept})`,lp.assetNo);
  renderLaptops();
  if (dpOpen && dpCurrentType==='laptop' && dpCurrentId===lp.id) dpLaptop(lp.id);
  showToast(`Assigned to ${name}`,'t-success');
}

function openMaint(id) {
  const lp = laptops.find(x => x.id === id);
  if (!lp) return;
  currentLpId = id;
  document.getElementById('maint-name').textContent = lp.desc;
  document.getElementById('maint-sn').textContent   = lp.serial;
  document.getElementById('maint-date').value       = todayStr();
  document.getElementById('maint-tech').value       = currentUser.name;
  document.getElementById('maint-cond').value       = 'GOOD';
  document.getElementById('maint-remarks').value    = '';
  openM('m-maint');
}

function saveMaintenance() {
  const lp = laptops.find(x => x.id === currentLpId);
  if (!lp) return;
  const cond    = document.getElementById('maint-cond').value;
  const date    = document.getElementById('maint-date').value;
  const tech    = document.getElementById('maint-tech').value.trim();
  const remarks = document.getElementById('maint-remarks').value.trim();
  if (!lp.maintHistory) lp.maintHistory = [];
  lp.maintHistory.push({ date, cond, tech, remarks });
  lp.maint  = cond;
  lp.status = cond==='GOOD' ? 'Active' : 'For Repair';
  closeM('m-maint');
  addLog('UPDATE','Laptops',`Maintenance record: "${lp.desc}" → ${cond}. ${remarks}`,lp.assetNo);
  renderLaptops();
  if (dpOpen && dpCurrentType==='laptop' && dpCurrentId===lp.id) dpLaptop(lp.id);
  showToast(`Maintenance saved: ${cond}`, cond==='GOOD'?'t-success':'t-warning');
}

function deleteLaptop(id) {
  const lp = laptops.find(x => x.id === id);
  if (!lp || !confirm(`Delete "${lp.desc}"?`)) return;
  laptops = laptops.filter(x => x.id !== id);
  addLog('DELETE','Laptops',`Deleted laptop: "${lp.desc}" (${lp.assetNo})`,lp.assetNo);
  closeDP(); renderLaptops(); showToast('Laptop deleted','t-warning');
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
        <button onclick="event.stopPropagation(); deleteGlobe(${g.plan_id}, '${g.employee_name}')">🗑️</button>
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


function dpGlobe(id) {
  const g = globePlans.find(x => x.id === id);
  if (!g) return;
  const sCls = g.status==='Active'?'b-green':g.status==='For Renewal'?'b-red':'b-slate';
  setDPHeader('📱','#f0fdf4', g.name, 'Globe Mobile Plan');
  const html = `
    <div class="dp-status-row">${badge(g.status, sCls)}<span class="dp-status-label">Plan status</span></div>
    <div class="dp-section">
      <div class="dp-section-hd">👤 Subscriber Information</div>
      <div class="dp-grid">
        ${dpFieldFull('Employee Name',`<strong>${g.name}</strong>`)}
        ${dpField('Mobile Number', g.num, 'mono')}
        ${dpField('Account Number', g.acct, 'mono')}
      </div>
    </div>
    <div class="dp-section">
      <div class="dp-section-hd">📱 Plan Details</div>
      <div class="dp-grid">
        ${dpFieldFull('Plan Name', g.plan)}
        ${dpField('Monthly Cost', '₱'+g.cost.toLocaleString())}
        ${dpField('Data Allocation', g.data)}
        ${dpField('Credit Limit', '₱'+g.credit.toLocaleString())}
        ${dpField('Renewal Date', g.renew, 'mono')}
      </div>
    </div>
    ${g.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes',g.remarks)}</div></div>` : ''}
    <div class="dp-section"><div class="dp-section-hd">⚡ Actions</div><div class="dp-action-row"><button class="btn btn-primary btn-sm" onclick="editGlobe(${g.id})">✏️ Edit</button><button class="btn btn-red btn-sm" onclick="deleteGlobe(${g.id})">🗑️ Delete</button></div></div>`;
  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

function saveGlobe() {

  const userName = document.getElementById("globe-f-user").value;

  if (!selectState["globe-f-user"]) {
    showToast("Select valid user", "t-error");
    return;
  }

  const payload = {
    user_id: globeUserMap[userName],
    mobile_number: document.getElementById("globe-f-num").value,
    account_number: document.getElementById("globe-f-acct").value,
    plan_name: document.getElementById("globe-f-plan").value,
    data_allocation: document.getElementById("globe-f-data").value,
    monthly_cost: document.getElementById("globe-f-cost").value,
    credit_limit: document.getElementById("globe-f-credit").value,
    renewal_date: document.getElementById("globe-f-renew").value,
    status: "Active",
    remarks: document.getElementById("globe-f-remarks").value
  };

  fetch(`${API_URL}/api/globe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
  .then(() => {
    showToast("Plan added", "t-success");
    closeM("m-add-globe");
    renderGlobe();
  });
}

async function editGlobe(id) {
  const res = await fetch(`${API_URL}/api/globe`);
  const data = await res.json();

  const g = data.find(x => x.plan_id === id);
  if (!g) return;

  globeEditId = id;

  document.getElementById('globe-f-name').value    = g.employee_name;
  document.getElementById('globe-f-num').value     = g.mobile_number;
  document.getElementById('globe-f-acct').value    = g.account_number;
  document.getElementById('globe-f-plan').value    = g.plan_name;
  document.getElementById('globe-f-cost').value    = g.monthly_cost;
  document.getElementById('globe-f-data').value    = g.data_allocation;
  document.getElementById('globe-f-renew').value   = g.renewal_date || "";
  document.getElementById('globe-f-credit').value  = g.credit_limit;
  document.getElementById('globe-f-remarks').value = g.remarks || "";

  openM('m-add-globe');
}

function deleteGlobe(id, name) {
  if (!confirm(`Delete plan for "${name}"?`)) return;

  fetch(`${API_URL}/api/globe/${id}`, {
    method: "DELETE"
  })
  .then(() => {
    showToast("Plan deleted", "t-warning");
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









/* ──────────────────────────────────────────────────────────────
   M365 LICENSES
────────────────────────────────────────────────────────────── */
let m365Items = [
  { id:1, email:'maria.alonzo@company.ph',  type:'Microsoft 365 Business Premium', cat:'Subscription', expiry:'2027-01-01', cost:1850, supplier:'Microsoft Direct', status:'Active',      remarks:'Admin account with full suite.' },
  { id:2, email:'juan.reyes@company.ph',    type:'Microsoft 365 Business Standard', cat:'Subscription', expiry:'2027-01-01', cost:1200, supplier:'Microsoft Direct', status:'Active',      remarks:'' },
  { id:3, email:'ana.cruz@company.ph',      type:'Microsoft 365 Business Basic',   cat:'Subscription', expiry:'2025-06-01', cost:550,  supplier:'CDRKing',         status:'Expired',     remarks:'Needs renewal.' },
  { id:4, email:'carlos.santos@company.ph', type:'Microsoft 365 Apps',             cat:'Subscription', expiry:'2026-12-01', cost:950,  supplier:'Microsoft Direct', status:'Active',      remarks:'' },
  { id:5, email:'rosa.flores@company.ph',   type:'Office 2021 (Perpetual)',        cat:'Perpetual',    expiry:'N/A',        cost:8000, supplier:'PC Express',      status:'Active',      remarks:'One-time purchase. No renewal.' },
  { id:6, email:'temp.account@company.ph',  type:'Microsoft 365 Business Basic',   cat:'Trial',        expiry:'2026-03-01', cost:0,    supplier:'Microsoft Direct', status:'Not Renewed', remarks:'Trial expired.' },
];
let m365Id = 7;

function renderM365() {
  const tbody = document.getElementById('m365-tbody');
  tbody.innerHTML = '';
  let expired = 0;
  m365Items.forEach(m => {
    const sCls = {Active:'b-green',Expired:'b-red','Not Renewed':'b-amber','No License':'b-slate'}[m.status]||'b-slate';
    if (m.status==='Expired') expired++;
    const tr = document.createElement('tr');
    tr.className = 'tr-clickable' + (m.status==='Expired'?' tr-danger':'');
    tr.innerHTML = `
      <td class="td-mono">${m.email}</td>
      <td>${m.type}</td>
      <td>${badge(m.cat,'b-slate b-none')}</td>
      <td class="td-mono">${m.expiry}</td>
      <td>${m.cost?'₱'+m.cost.toLocaleString()+'/mo':'One-time'}</td>
      <td>${badge(m.status, sCls)}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editM365(${m.id})">✏️</button>
          <button class="btn btn-xs btn-red" onclick="event.stopPropagation();deleteM365(${m.id})">🗑️</button>
        </div>
      </td>`;
    tr.addEventListener('click', () => openDP('m365', m.id, tr));
    tbody.appendChild(tr);
  });
  document.getElementById('m365-ct').textContent    = `${m365Items.length} licenses`;
  document.getElementById('m365-exp-ct').textContent = `${expired} expired`;
}

function dpM365(id) {
  const m = m365Items.find(x => x.id === id);
  if (!m) return;
  const sCls = {Active:'b-green',Expired:'b-red','Not Renewed':'b-amber','No License':'b-slate'}[m.status]||'b-slate';
  setDPHeader('💼',m.status==='Expired'?'#fef2f2':'#f0fdf4', m.email, 'M365 License');
  const html = `
    ${m.status==='Expired'?`<div class="dp-alert danger">⚠️ <span class="dp-alert-text">License expired! Renew to restore access.</span></div>`:''}
    <div class="dp-status-row">${badge(m.status, sCls)}<span class="dp-status-label">License status</span></div>
    <div class="dp-section">
      <div class="dp-section-hd">📧 License Details</div>
      <div class="dp-grid">
        ${dpFieldFull('Assigned Email',`<strong>${m.email}</strong>`)}
        ${dpFieldFull('License Type', m.type)}
        ${dpField('Category', m.cat)}
        ${dpField('Expiry Date', m.expiry, 'mono')}
        ${dpField('Monthly Cost', m.cost?'₱'+m.cost.toLocaleString()+'/mo':'One-time ₱'+m.cost?.toLocaleString())}
        ${dpField('Supplier', m.supplier)}
      </div>
    </div>
    ${m.remarks?`<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes',m.remarks)}</div></div>`:''}
    <div class="dp-section"><div class="dp-section-hd">⚡ Actions</div><div class="dp-action-row"><button class="btn btn-primary btn-sm" onclick="editM365(${m.id})">✏️ Edit</button><button class="btn btn-red btn-sm" onclick="deleteM365(${m.id})">🗑️ Delete</button></div></div>`;
  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

function saveM365() {
  const email    = document.getElementById('m365-f-email').value.trim();
  const type     = document.getElementById('m365-f-type').value;
  const cat      = document.getElementById('m365-f-cat').value;
  const expiry   = document.getElementById('m365-f-expiry').value||'N/A';
  const cost     = parseFloat(document.getElementById('m365-f-cost').value)||0;
  const supplier = document.getElementById('m365-f-supplier').value.trim()||'Microsoft';
  const remarks  = document.getElementById('m365-f-remarks').value.trim();
  if (!email) { showToast('Email required','t-error'); return; }
  m365Items.push({ id:m365Id++, email,type,cat,expiry,cost,supplier,status:'Active',remarks });
  closeM('m-add-m365');
  clearForm(['m365-f-email','m365-f-expiry','m365-f-cost','m365-f-supplier','m365-f-remarks']);
  addLog('CREATE','M365 Licenses',`Added M365 license for ${email}: ${type}`,email);
  renderM365(); showToast(`License added for ${email}`,'t-success');
}

function editM365(id) {
  const m = m365Items.find(x => x.id === id);
  if (!m) return;
  document.getElementById('m365-f-email').value    = m.email;
  document.getElementById('m365-f-type').value     = m.type;
  document.getElementById('m365-f-cat').value      = m.cat;
  document.getElementById('m365-f-expiry').value   = m.expiry!=='N/A'?m.expiry:'';
  document.getElementById('m365-f-cost').value     = m.cost;
  document.getElementById('m365-f-supplier').value = m.supplier;
  document.getElementById('m365-f-remarks').value  = m.remarks||'';
  m365Items = m365Items.filter(x => x.id !== id);
  openM('m-add-m365');
}

function deleteM365(id) {
  const m = m365Items.find(x => x.id === id);
  if (!m || !confirm(`Delete license for "${m.email}"?`)) return;
  m365Items = m365Items.filter(x => x.id !== id);
  addLog('DELETE','M365 Licenses',`Deleted license: ${m.email}`,m.email);
  closeDP(); renderM365(); showToast('License deleted','t-warning');
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

  // Default date fields
  ['fur-f-date','it-f-warranty','lp-f-warranty','lp-f-bought','po-f-date','po-f-eta',
   'maint-date','vm-date','vm-next','veh-f-maint','veh-f-orcr','globe-f-renew','m365-f-expiry'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.type==='date') el.value = todayStr();
  });

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

