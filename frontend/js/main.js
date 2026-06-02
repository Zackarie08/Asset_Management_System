/* ══════════════════════════════════════════════════════════════
   ASSET MANAGEMENT SYSTEM — COMPLETE JAVASCRIPT
   Version 2.0 | Pure JS | No Backend
══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────
   SESSION / AUTH
────────────────────────────────────────────────────────────── */
let currentUser = null; // { name, role, initials }

const USERS = {
  admin: { name:'Maria Alonzo',   role:'admin',    initials:'MA', title:'Administrator' },
  emp1:  { name:'Juan Reyes',     role:'employee', initials:'JR', title:'IT Technician' },
  emp2:  { name:'Ana Cruz',       role:'employee', initials:'AC', title:'Finance Officer' },
  emp3:  { name:'Carlos Santos',  role:'employee', initials:'CS', title:'Operations Staff' },
};


/* ──────────────────────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────────────────────── */
const PAGE_META = {
  dashboard:  { title:'Dashboard',         parent:'AssetCore' },
  inventory:  { title:'Inventory Management', parent:'AssetCore' },
  furniture:  { title:'Office Furniture',  parent:'AssetCore' },
  itsupplies: { title:'IT Supplies',       parent:'AssetCore' },
  laptops:    { title:'Laptop Management', parent:'AssetCore' },
  orders:     { title:'Purchase Orders',   parent:'AssetCore' },
  vehicles:   { title:'Vehicle Management',parent:'AssetCore' },
  globe:      { title:'Globe Mobile Plans',parent:'AssetCore' },
  m365:       { title:'M365 Licenses',     parent:'AssetCore' },
  logs:       { title:'System Logs',       parent:'AssetCore' },
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
    itsupply:  dpITSupply,
    laptop:    dpLaptop,
    order:     dpOrder,
    vehicle:   dpVehicle,
    globe:     dpGlobe,
    m365:      dpM365,
    log:       dpLog,
  };
  if (renderers[type]) renderers[type](id);
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
let furItems = [
  { id:1, name:'Executive Office Chair',   qty:10, date:'2024-01-15', supplier:'OfficePro PH',  contact:'sales@officepro.ph',  price:4500,  loc:'3F Executive Wing',  condition:'Good',   remarks:'Leather upholstery, lumbar support.' },
  { id:2, name:'Steel Filing Cabinet 4D',  qty:6,  date:'2024-03-20', supplier:'StoreAll Inc.', contact:'orders@storeall.ph',  price:6800,  loc:'Storage Room A',     condition:'Good',   remarks:'' },
  { id:3, name:'Conference Table (8-pax)', qty:2,  date:'2023-11-05', supplier:'Furni Corp PH', contact:'furni@furnicorp.ph',  price:28000, loc:'2F Conference Room', condition:'Good',   remarks:'Solid wood, foldable legs.' },
  { id:4, name:'Standing Desk (ErgoLift)', qty:5,  date:'2025-02-10', supplier:'ErgoDesk PH',   contact:'info@ergodesk.ph',   price:12500, loc:'IT Department',      condition:'New',    remarks:'Height adjustable 72–120cm.' },
  { id:5, name:'Visitor Chair (Padded)',   qty:20, date:'2024-06-01', supplier:'OfficePro PH',  contact:'sales@officepro.ph',  price:1800,  loc:'Reception & Lobby',  condition:'Fair',   remarks:'2 units need reupholstering.' },
];
let furId = 6;

function renderFurniture() {
  const isAdmin = currentUser.role === 'admin';
  const tbody = document.getElementById('fur-tbody');
  tbody.innerHTML = '';
  furItems.forEach(f => {
    const condCls = {New:'b-blue',Good:'b-green',Fair:'b-amber','For Repair':'b-red'}[f.condition]||'b-slate';
    const tr = document.createElement('tr');
    tr.className = 'tr-clickable';
    tr.innerHTML = `
      <td class="td-strong">${f.name}</td>
      <td>${f.qty}</td>
      <td class="td-mono">${f.date}</td>
      <td>${f.supplier}</td>
      <td>₱${f.price.toLocaleString()}</td>
      <td class="td-muted">${f.loc}</td>
      <td>${badge(f.condition, condCls)}</td>
      <td>
        ${isAdmin ? `<div class="flex-gap"><button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editFur(${f.id})">✏️</button><button class="btn btn-xs btn-red" onclick="event.stopPropagation();deleteFur(${f.id})">🗑️</button></div>` : '<span class="td-muted">View only</span>'}
      </td>`;
    tr.addEventListener('click', () => openDP('furniture', f.id, tr));
    tbody.appendChild(tr);
  });
  document.getElementById('fur-ct').textContent = `${furItems.length} items`;
}

function dpFurniture(id) {
  const f = furItems.find(x => x.id === id);
  if (!f) return;
  const isAdmin = currentUser.role === 'admin';
  const condCls = {New:'b-blue',Good:'b-green',Fair:'b-amber','For Repair':'b-red'}[f.condition]||'b-slate';
  setDPHeader('🪑','#fffbeb', f.name, 'Office Furniture');
  let html = `
    <div class="dp-status-row">${badge(f.condition,condCls)}<span class="dp-status-label">Condition status</span></div>
    <div class="dp-section">
      <div class="dp-section-hd">📦 Asset Information</div>
      <div class="dp-grid">
        ${dpFieldFull('Asset Name',`<strong>${f.name}</strong>`)}
        ${dpField('Quantity', f.qty)}
        ${dpField('Location', f.loc)}
        ${dpField('Date Purchased', f.date, 'mono')}
        ${dpField('Price / Unit', '₱'+f.price.toLocaleString())}
        ${dpField('Total Value', '₱'+(f.price*f.qty).toLocaleString())}
      </div>
    </div>
    <div class="dp-section">
      <div class="dp-section-hd">🏪 Supplier</div>
      <div class="supplier-card">
        <div class="sc-name">🏢 ${f.supplier||'—'}</div>
        <div class="sc-note">Contact supplier for additional units or maintenance support</div>
        <span class="sc-link" onclick="showToast('Contacting ${f.supplier}…','t-info')">🔗 View Supplier</span>
      </div>
      <div class="dp-grid" style="margin-top:9px">${dpField('Contact',f.contact)}</div>
    </div>
    ${f.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes',f.remarks)}</div></div>` : ''}`;

  if (isAdmin) html += `<div class="dp-section"><div class="dp-section-hd">⚡ Actions</div><div class="dp-action-row"><button class="btn btn-primary btn-sm" onclick="editFur(${f.id})">✏️ Edit</button><button class="btn btn-red btn-sm" onclick="deleteFur(${f.id})">🗑️ Delete</button></div></div>`;
  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

function saveFurniture() {
  const name     = document.getElementById('fur-f-name').value.trim();
  const qty      = parseInt(document.getElementById('fur-f-qty').value)||1;
  const date     = document.getElementById('fur-f-date').value||todayStr();
  const supplier = document.getElementById('fur-f-supplier').value.trim()||'N/A';
  const price    = parseFloat(document.getElementById('fur-f-price').value)||0;
  const loc      = document.getElementById('fur-f-loc').value.trim();
  const condition= document.getElementById('fur-f-cond').value;
  const contact  = document.getElementById('fur-f-contact').value.trim();
  const remarks  = document.getElementById('fur-f-remarks').value.trim();
  if (!name) { showToast('Asset name required','t-error'); return; }
  furItems.push({ id:furId++, name,qty,date,supplier,contact,price,loc,condition,remarks });
  closeM('m-add-fur');
  clearForm(['fur-f-name','fur-f-qty','fur-f-date','fur-f-supplier','fur-f-price','fur-f-loc','fur-f-contact','fur-f-remarks']);
  addLog('CREATE','Furniture',`Added furniture: "${name}" (x${qty}) at ${loc}`,`FUR-${furId-1}`);
  renderFurniture(); showToast(`"${name}" added`,'t-success');
}

function editFur(id) {
  const f = furItems.find(x => x.id === id);
  if (!f) return;
  document.getElementById('fur-f-name').value     = f.name;
  document.getElementById('fur-f-qty').value      = f.qty;
  document.getElementById('fur-f-date').value     = f.date;
  document.getElementById('fur-f-supplier').value = f.supplier;
  document.getElementById('fur-f-price').value    = f.price;
  document.getElementById('fur-f-loc').value      = f.loc;
  document.getElementById('fur-f-cond').value     = f.condition;
  document.getElementById('fur-f-contact').value  = f.contact||'';
  document.getElementById('fur-f-remarks').value  = f.remarks||'';
  // simple overwrite approach
  furItems = furItems.filter(x => x.id !== id);
  openM('m-add-fur');
}

function deleteFur(id) {
  const f = furItems.find(x => x.id === id);
  if (!f || !confirm(`Delete "${f.name}"?`)) return;
  furItems = furItems.filter(x => x.id !== id);
  addLog('DELETE','Furniture',`Deleted: "${f.name}"`,`FUR-${id}`);
  closeDP(); renderFurniture(); showToast('Furniture deleted','t-warning');
}

/* ──────────────────────────────────────────────────────────────
   IT SUPPLIES
────────────────────────────────────────────────────────────── */
let itItems = [
  { id:1, name:'HP Toner CF280A',      serial:'TON-HP-280A',    qty:1,  reorder:3,  warranty:'2027-06-01', supplier:'HP Philippines',   contact:'hp-ph@support.com',  website:'https://hp.com',   remarks:'For HP LaserJet Pro 400.' },
  { id:2, name:'Thermal Paper Rolls',  serial:'TPR-80MM-STD',   qty:2,  reorder:10, warranty:'N/A',        supplier:'PrintMart PH',     contact:'sales@printmart.ph', website:'',                 remarks:'POS receipt paper.' },
  { id:3, name:'USB-C Cables 2m',      serial:'USB-C-2M-BLK',   qty:3,  reorder:5,  warranty:'N/A',        supplier:'TechHub Supplies',  contact:'orders@techhub.ph',  website:'',                 remarks:'' },
  { id:4, name:'Network Switch 8-Port',serial:'TP-LINK-TL-SG108',qty:2,  reorder:1,  warranty:'2028-01-15', supplier:'TP-Link Philippines',contact:'ph@tp-link.com',    website:'https://tp-link.com',remarks:'Unmanaged gigabit switch.' },
  { id:5, name:'Wireless Mouse M185',  serial:'LOG-M185-GRY',   qty:8,  reorder:3,  warranty:'2026-12-01', supplier:'Logitech PH',      contact:'ph@logitech.com',    website:'https://logitech.com',remarks:'USB nano receiver included.' },
  { id:6, name:'HDMI Cable 3m',        serial:'HDMI-3M-BLK',    qty:12, reorder:5,  warranty:'N/A',        supplier:'CablePro Supplies', contact:'info@cablepro.ph',   website:'',                 remarks:'' },
];
let itId = 7;

function renderITSupplies() {
  const isAdmin = currentUser.role === 'admin';
  const tbody = document.getElementById('it-tbody');
  tbody.innerHTML = '';
  let low = 0;
  itItems.forEach(s => {
    const isLow = s.qty <= s.reorder;
    if (isLow) low++;
    const tr = document.createElement('tr');
    tr.className = 'tr-clickable' + (isLow ? ' tr-warn' : '');
    tr.innerHTML = `
      <td class="td-strong">${s.name}</td>
      <td class="td-mono">${s.serial}</td>
      <td>${s.qty}</td>
      <td>${s.reorder}</td>
      <td class="td-mono">${s.warranty}</td>
      <td>${s.supplier}</td>
      <td>${isLow ? badge('LOW STOCK','b-red') : badge('OK','b-green')}</td>
      <td>
        ${isAdmin ? `<div class="flex-gap"><button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editIT(${s.id})">✏️</button><button class="btn btn-xs btn-red" onclick="event.stopPropagation();deleteIT(${s.id})">🗑️</button></div>` : '<span class="td-muted">View only</span>'}
      </td>`;
    tr.addEventListener('click', () => openDP('itsupply', s.id, tr));
    tbody.appendChild(tr);
  });
  document.getElementById('it-total-ct').textContent = `${itItems.length} items`;
  document.getElementById('it-low-ct').textContent   = `${low} low stock`;
  const nb = document.getElementById('nb-it');
  if (nb) { nb.textContent = low; nb.style.display = low ? '' : 'none'; }
}

function dpITSupply(id) {
  const s = itItems.find(x => x.id === id);
  if (!s) return;
  const isAdmin = currentUser.role === 'admin';
  const isLow = s.qty <= s.reorder;
  const progress = Math.min(100, Math.round((s.qty/Math.max(s.reorder*2,1))*100));
  setDPHeader('🖨️', isLow ? '#fef2f2':'#eff6ff', s.name, 'IT Supply');
  let html = `
    ${isLow ? `<div class="dp-alert warning">⚠️ <span class="dp-alert-text">Below reorder level. Contact supplier to replenish.</span></div>` : ''}
    <div class="dp-status-row">${isLow?badge('LOW STOCK','b-red'):badge('OK','b-green')}<span class="dp-status-label">Qty: <strong>${s.qty}</strong> / Reorder at: <strong>${s.reorder}</strong></span></div>
    <div class="prog-bar-wrap">
      <div class="prog-bar-labels"><span>Stock Level</span><span>${s.qty} units</span></div>
      <div class="prog-bar-track"><div class="prog-bar-fill" style="width:${progress}%;background:${isLow?'#ef4444':'#22c55e'}"></div></div>
    </div>
    <div class="dp-section">
      <div class="dp-section-hd">💻 Asset Details</div>
      <div class="dp-grid">
        ${dpFieldFull('Asset Name',`<strong>${s.name}</strong>`)}
        ${dpField('Serial / Model', s.serial, 'mono')}
        ${dpField('Warranty Expiry', s.warranty, 'mono')}
        ${dpField('Quantity', s.qty)}
        ${dpField('Reorder Level', s.reorder)}
      </div>
    </div>
    <div class="dp-section">
      <div class="dp-section-hd">🏪 Supplier Information</div>
      <div class="supplier-card">
        <div class="sc-name">🏢 ${s.supplier}</div>
        <div class="sc-note">Contact supplier to place replenishment order</div>
        <span class="sc-link" onclick="showToast('Contacting ${s.supplier}…','t-info')">🔗 Visit Supplier</span>
      </div>
      <div class="dp-grid" style="margin-top:9px">
        ${dpField('Contact', s.contact)}
        ${dpField('Website', s.website || null)}
      </div>
      <div class="dp-alert info" style="margin-top:10px">📋 <span class="dp-alert-text">To restock: Contact supplier above, then create a Purchase Order in the PO module.</span></div>
    </div>
    ${s.remarks ? `<div class="dp-section"><div class="dp-section-hd">📝 Remarks</div><div class="dp-grid">${dpFieldFull('Notes',s.remarks)}</div></div>` : ''}`;

  if (isAdmin) html += `<div class="dp-section"><div class="dp-section-hd">⚡ Actions</div><div class="dp-action-row"><button class="btn btn-supplier btn-sm" onclick="showToast('Contacting ${s.supplier}…','t-info')">🔗 Supplier</button><button class="btn btn-primary btn-sm" onclick="openCreatePOForIT(${s.id})">📦 Create PO</button><button class="btn btn-outline btn-sm" onclick="editIT(${s.id})">✏️ Edit</button><button class="btn btn-red btn-sm" onclick="deleteIT(${s.id})">🗑️ Delete</button></div></div>`;
  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

function openCreatePOForIT(id) {
  const s = itItems.find(x => x.id === id);
  if (!s) return;
  document.getElementById('po-f-item').value     = s.name;
  document.getElementById('po-f-supplier').value = s.supplier||'';
  document.getElementById('po-f-cat').value      = 'IT Supplies';
  document.getElementById('po-f-date').value     = todayStr();
  openM('m-add-po');
}

function saveITSupply() {
  const name     = document.getElementById('it-f-name').value.trim();
  const serial   = document.getElementById('it-f-serial').value.trim()||'N/A';
  const qty      = parseInt(document.getElementById('it-f-qty').value)||0;
  const reorder  = parseInt(document.getElementById('it-f-reorder').value)||5;
  const warranty = document.getElementById('it-f-warranty').value||'N/A';
  const supplier = document.getElementById('it-f-supplier').value.trim()||'N/A';
  const contact  = document.getElementById('it-f-contact').value.trim();
  const website  = document.getElementById('it-f-website').value.trim();
  const remarks  = document.getElementById('it-f-remarks').value.trim();
  if (!name) { showToast('Asset name required','t-error'); return; }
  itItems.push({ id:itId++, name,serial,qty,reorder,warranty,supplier,contact,website,remarks });
  closeM('m-add-it');
  clearForm(['it-f-name','it-f-serial','it-f-qty','it-f-reorder','it-f-warranty','it-f-supplier','it-f-contact','it-f-website','it-f-remarks']);
  addLog('CREATE','IT Supplies',`Added IT supply: "${name}" (SN: ${serial})`,`IT-${itId-1}`);
  renderITSupplies(); showToast(`"${name}" added`,'t-success');
}

function editIT(id) {
  const s = itItems.find(x => x.id === id);
  if (!s) return;
  document.getElementById('it-f-name').value     = s.name;
  document.getElementById('it-f-serial').value   = s.serial;
  document.getElementById('it-f-qty').value      = s.qty;
  document.getElementById('it-f-reorder').value  = s.reorder;
  document.getElementById('it-f-warranty').value = s.warranty !== 'N/A' ? s.warranty : '';
  document.getElementById('it-f-supplier').value = s.supplier;
  document.getElementById('it-f-contact').value  = s.contact||'';
  document.getElementById('it-f-website').value  = s.website||'';
  document.getElementById('it-f-remarks').value  = s.remarks||'';
  itItems = itItems.filter(x => x.id !== id);
  openM('m-add-it');
}

function deleteIT(id) {
  const s = itItems.find(x => x.id === id);
  if (!s || !confirm(`Delete "${s.name}"?`)) return;
  itItems = itItems.filter(x => x.id !== id);
  addLog('DELETE','IT Supplies',`Deleted: "${s.name}"`,`IT-${id}`);
  closeDP(); renderITSupplies(); showToast('IT supply deleted','t-warning');
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
  const isAdmin = currentUser.role === 'admin';
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
  const isAdmin = currentUser.role === 'admin';
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
let poItems = [
  { id:1, poNum:'PO-2026-0001', item:'Bond Paper (Short)',       cat:'Office Supplies', qty:20, unit:'Ream',   supplier:'PaperWorld Inc.',    price:280,  orderDate:'2026-05-14', eta:'2026-05-22', status:'IN TRANSIT', notes:'Urgent. Deliver to storage room A.',    delivered:null },
  { id:2, poNum:'PO-2026-0002', item:'Office Chairs (Mesh)',     cat:'Furniture',       qty:5,  unit:'Piece',  supplier:'OfficePro PH',       price:4200, orderDate:'2026-04-28', eta:'2026-05-10', status:'ORDERED',    notes:'Replacement for worn chairs.',          delivered:null },
  { id:3, poNum:'PO-2026-0003', item:'HP Toner CF280A',         cat:'IT Supplies',     qty:6,  unit:'Piece',  supplier:'HP Philippines',     price:3500, orderDate:'2026-05-16', eta:'2026-05-25', status:'ORDERED',    notes:'Request official receipt.',             delivered:null },
  { id:4, poNum:'PO-2026-0004', item:'Coffee 3-in-1 Sachet',    cat:'Pantry Supplies', qty:10, unit:'Box',    supplier:'Nestle Distributor', price:350,  orderDate:'2026-04-25', eta:'2026-05-01', status:'ORDERED',    notes:'',                                     delivered:null },
  { id:5, poNum:'PO-2026-0005', item:'Bandage Rolls',           cat:'First Aid Kit',   qty:20, unit:'Roll',   supplier:'Mercury Drug',       price:40,   orderDate:'2026-05-17', eta:'2026-05-30', status:'ORDERED',    notes:'Emergency restock.',                   delivered:null },
  { id:6, poNum:'PO-2026-0006', item:'USB-C Cables 2m',         cat:'IT Supplies',     qty:15, unit:'Piece',  supplier:'TechHub Supplies',   price:280,  orderDate:'2026-04-10', eta:'2026-04-20', status:'DELIVERED',  notes:'',                                     delivered:'2026-04-19' },
  { id:7, poNum:'PO-2026-0007', item:'Mineral Water 500mL',     cat:'Pantry Supplies', qty:100,unit:'Bottle', supplier:'Selecta Distributor',price:20,   orderDate:'2026-05-01', eta:'2026-05-05', status:'DELIVERED',  notes:'Weekly restock.',                       delivered:'2026-05-04' },
];
let poId = 8;

function renderOrders() {
  const isAdmin = currentUser.role === 'admin';
  const now = new Date(); now.setHours(0,0,0,0);
  const tbody = document.getElementById('po-tbody');
  tbody.innerHTML = '';
  let delayed = 0, pending = 0;

  poItems.forEach(o => {
    let status = o.status;
    const etaDate = o.eta ? new Date(o.eta) : null;
    if (status !== 'DELIVERED' && etaDate && etaDate < now) status = 'DELAYED';
    if (status === 'DELAYED') delayed++;
    if (['ORDERED','IN TRANSIT','DELAYED'].includes(status)) pending++;

    const sCls = {ORDERED:'b-amber','IN TRANSIT':'b-blue',DELIVERED:'b-green',DELAYED:'b-red'}[status]||'b-slate';
    const sIcon = {ORDERED:'📋','IN TRANSIT':'🚚',DELIVERED:'✅',DELAYED:'⏰'}[status]||'';

    const tr = document.createElement('tr');
    tr.className = 'tr-clickable' + (status==='DELAYED'?' tr-warn':'') + (status==='DELIVERED'?' ':'');
    tr.innerHTML = `
      <td class="td-mono">${o.poNum}</td>
      <td class="td-strong">${o.item}</td>
      <td>${badge(o.cat,'b-slate b-none')}</td>
      <td>${o.qty} ${o.unit}</td>
      <td class="td-mono">${o.orderDate}</td>
      <td class="td-mono">${o.eta||'—'}</td>
      <td>${badge(sIcon+' '+status, sCls)}</td>
      <td>
        ${isAdmin && status!=='DELIVERED' ? `<button class="btn btn-xs btn-green" title="Mark Delivered" onclick="event.stopPropagation();markDelivered(${o.id})">✅</button>` : ''}
        ${isAdmin ? `<button class="btn btn-xs btn-red" onclick="event.stopPropagation();deletePO(${o.id})">🗑️</button>` : ''}
      </td>`;
    tr.addEventListener('click', () => openDP('order', o.id, tr));
    tbody.appendChild(tr);
  });

  document.getElementById('po-total-ct').textContent = `${poItems.length} orders`;
  document.getElementById('po-delay-ct').textContent  = `${delayed} delayed`;
  const nb = document.getElementById('nb-po');
  if (nb) { nb.textContent = pending; nb.style.display = pending ? '' : 'none'; }
  refreshDashboard();
}

function dpOrder(id) {
  const o = poItems.find(x => x.id === id);
  if (!o) return;
  const isAdmin = currentUser.role === 'admin';
  const now = new Date(); now.setHours(0,0,0,0);
  const etaDate = o.eta ? new Date(o.eta) : null;
  let status = o.status;
  if (status!=='DELIVERED' && etaDate && etaDate < now) status = 'DELAYED';
  const isDelayed = status === 'DELAYED';
  const daysLate = isDelayed && etaDate ? Math.floor((now-etaDate)/86400000) : 0;
  const sCls = {ORDERED:'b-amber','IN TRANSIT':'b-blue',DELIVERED:'b-green',DELAYED:'b-red'}[status]||'b-slate';
  setDPHeader('🛒',isDelayed?'#fef2f2':status==='DELIVERED'?'#f0fdf4':'#eff6ff', o.item, o.poNum);

  let html = `
    ${isDelayed ? `<div class="dp-alert danger">⏰ <span class="dp-alert-text">Delivery is ${daysLate} day${daysLate!==1?'s':''} overdue. Follow up with supplier.</span></div>` : ''}
    <div class="dp-status-row">${badge(status, sCls)}<span class="dp-status-label">Order status</span></div>

    <div class="dp-section">
      <div class="dp-section-hd">📦 Order Information</div>
      <div class="dp-grid">
        ${dpFieldFull('Item Name',`<strong>${o.item}</strong>`)}
        ${dpField('PO Number', o.poNum, 'mono')}
        ${dpField('Category', o.cat)}
        ${dpField('Quantity', o.qty+' '+o.unit)}
        ${dpField('Unit Price', o.price?'₱'+o.price.toLocaleString():null)}
        ${dpField('Total Cost', o.price?'₱'+(o.price*o.qty).toLocaleString():null)}
        ${dpField('Order Date', o.orderDate, 'mono')}
        ${dpField('Expected Delivery', o.eta||'—', 'mono')}
        ${dpField('Actual Delivery', o.delivered||'Pending', 'mono')}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">🏪 Supplier</div>
      <div class="supplier-card">
        <div class="sc-name">🏢 ${o.supplier||'Not specified'}</div>
        <div class="sc-note">Contact supplier to follow up on delivery</div>
        <span class="sc-link" onclick="showToast('Contacting ${o.supplier}…','t-info')">🔗 Contact Supplier</span>
      </div>
    </div>

    ${o.notes ? `<div class="dp-section"><div class="dp-section-hd">📝 Notes</div><div class="dp-grid">${dpFieldFull('Order Notes',o.notes)}</div></div>` : ''}`;

  if (isAdmin && status!=='DELIVERED') {
    html += `<div class="dp-section"><div class="dp-section-hd">⚡ Actions</div><div class="dp-action-row"><button class="btn btn-green btn-sm" onclick="markDelivered(${o.id})">✅ Mark Delivered</button><button class="btn btn-red btn-sm" onclick="deletePO(${o.id})">🗑️ Delete</button></div></div>`;
  } else if (isAdmin) {
    html += `<div class="dp-section"><div class="dp-section-hd">⚡ Actions</div><div class="dp-action-row"><button class="btn btn-red btn-sm" onclick="deletePO(${o.id})">🗑️ Delete</button></div></div>`;
  }

  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

function savePO() {
  const item     = document.getElementById('po-f-item').value.trim();
  const cat      = document.getElementById('po-f-cat').value;
  const qty      = parseInt(document.getElementById('po-f-qty').value)||1;
  const unit     = document.getElementById('po-f-unit').value;
  const supplier = document.getElementById('po-f-supplier').value.trim()||'Not specified';
  const price    = parseFloat(document.getElementById('po-f-price').value)||0;
  const date     = document.getElementById('po-f-date').value||todayStr();
  const eta      = document.getElementById('po-f-eta').value||'';
  const notes    = document.getElementById('po-f-notes').value.trim();
  if (!item) { showToast('Item name required','t-error'); return; }
  const poNum = 'PO-'+new Date().getFullYear()+'-'+String(poId).padStart(4,'0');
  poItems.push({ id:poId++, poNum, item,cat,qty,unit,supplier,price,orderDate:date,eta,status:'ORDERED',notes,delivered:null });
  closeM('m-add-po');
  clearForm(['po-f-item','po-f-qty','po-f-supplier','po-f-price','po-f-date','po-f-eta','po-f-notes']);
  addLog('CREATE','Purchase Orders',`Created PO: "${item}" x${qty} from ${supplier}`,poNum);
  renderOrders(); showToast(`PO created: ${poNum}`,'t-success');
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
  closeDP(); renderOrders(); showToast('PO deleted','t-warning');
}

/* ──────────────────────────────────────────────────────────────
   VEHICLES
────────────────────────────────────────────────────────────── */
let vehicles = [
  { id:1, name:'Toyota Vios 2022',       type:'Car',        plate:'ABC 1234', assigned:'Pedro Cruz',     status:'Active',        nextMaint:'2026-06-15', year:2022, orcr:'2027-03-01', maintHistory:[{date:'2026-01-10',type:'Oil Change',odo:15000,cost:2500,next:'2026-06-15',remarks:'Castrol GTX 10W-40'}] },
  { id:2, name:'Honda Click 125i 2023',  type:'Motorcycle', plate:'XYZ 5678', assigned:'Marco Bautista', status:'Active',        nextMaint:'2026-07-01', year:2023, orcr:'2027-06-15', maintHistory:[{date:'2026-02-20',type:'General Checkup',odo:8500,cost:1200,next:'2026-07-01',remarks:'All good. Chain lubricated.'}] },
  { id:3, name:'Toyota Hiace 2020',      type:'Van',        plate:'DEF 9012', assigned:'Company Pool',   status:'For Maintenance',nextMaint:'2026-05-20', year:2020, orcr:'2026-08-30', maintHistory:[{date:'2025-11-15',type:'Brake Service',odo:72000,cost:8500,next:'2026-05-20',remarks:'Front pads replaced. Rear adjusted.'}] },
];
let vehId = 4;
let currentVehId = null;

function renderVehicles() {
  const isAdmin = currentUser.role === 'admin';
  const tbody = document.getElementById('veh-tbody');
  tbody.innerHTML = '';
  vehicles.forEach(v => {
    const sCls = {Active:'b-green','For Maintenance':'b-amber','Out of Service':'b-red'}[v.status]||'b-slate';
    const typeIcon = {Car:'🚗',Motorcycle:'🏍️',Van:'🚐',Truck:'🚛'}[v.type]||'🚗';
    const now = new Date(); now.setHours(0,0,0,0);
    const maintDue = v.nextMaint && new Date(v.nextMaint) <= now;
    const tr = document.createElement('tr');
    tr.className = 'tr-clickable' + (maintDue ? ' tr-warn' : '');
    tr.innerHTML = `
      <td class="td-strong">${typeIcon} ${v.name}</td>
      <td>${v.type}</td>
      <td class="td-mono">${v.plate}</td>
      <td>${v.assigned}</td>
      <td>${badge(v.status, sCls)}</td>
      <td class="td-mono ${maintDue?'text-red-600':''}">${v.nextMaint||'—'}</td>
      <td>
        ${isAdmin ? `<div class="flex-gap"><button class="btn btn-xs btn-outline" onclick="event.stopPropagation();openVehMaint(${v.id})">🔧</button><button class="btn btn-xs btn-red" onclick="event.stopPropagation();deleteVeh(${v.id})">🗑️</button></div>` : '<span class="td-muted">View only</span>'}
      </td>`;
    tr.addEventListener('click', () => openDP('vehicle', v.id, tr));
    tbody.appendChild(tr);
  });
  document.getElementById('veh-ct').textContent = `${vehicles.length} vehicles`;
}

function dpVehicle(id) {
  const v = vehicles.find(x => x.id === id);
  if (!v) return;
  const isAdmin = currentUser.role === 'admin';
  const sCls = {Active:'b-green','For Maintenance':'b-amber','Out of Service':'b-red'}[v.status]||'b-slate';
  const typeIcon = {Car:'🚗',Motorcycle:'🏍️',Van:'🚐',Truck:'🚛'}[v.type]||'🚗';
  const now = new Date(); now.setHours(0,0,0,0);
  const maintDue = v.nextMaint && new Date(v.nextMaint) <= now;
  setDPHeader(typeIcon,'#f0fdf4', v.name, v.plate);

  let histHTML = '';
  if (v.maintHistory && v.maintHistory.length) {
    histHTML = '<ul class="mh-list">' + v.maintHistory.slice().reverse().map(m =>
      `<li class="mh-item"><div class="mh-dot good"></div><div><div class="mh-cond good">${m.type}</div><div class="mh-date">${m.date} · ₱${m.cost?.toLocaleString()||'0'} · ${m.odo?.toLocaleString()||'0'} km</div><div class="mh-remarks">${m.remarks||'—'}</div></div></li>`
    ).join('') + '</ul>';
  } else {
    histHTML = '<div style="text-align:center;padding:16px;color:var(--slate-400);font-size:12px">No maintenance records.</div>';
  }

  let html = `
    ${maintDue ? `<div class="dp-alert warning">🔧 <span class="dp-alert-text">Maintenance is due! Last scheduled: ${v.nextMaint}</span></div>` : ''}
    <div class="dp-status-row">${badge(v.status,sCls)}<span class="dp-status-label">Vehicle status</span></div>

    <div class="dp-section">
      <div class="dp-section-hd">🚗 Vehicle Information</div>
      <div class="dp-grid">
        ${dpFieldFull('Vehicle Name',`<strong>${typeIcon} ${v.name}</strong>`)}
        ${dpField('Type', v.type)}
        ${dpField('Plate Number', v.plate, 'mono')}
        ${dpField('Year Model', v.year)}
        ${dpField('Assigned To', v.assigned)}
        ${dpField('OR/CR Expiry', v.orcr, 'mono')}
        ${dpField('Next Maintenance', v.nextMaint||'—', 'mono')}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">🔧 Service History</div>
      ${histHTML}
    </div>`;

  if (isAdmin) html += `<div class="dp-section"><div class="dp-section-hd">⚡ Actions</div><div class="dp-action-row"><button class="btn btn-primary btn-sm" onclick="openVehMaint(${v.id})">🔧 Add Maintenance Record</button><button class="btn btn-red btn-sm" onclick="deleteVeh(${v.id})">🗑️ Delete</button></div></div>`;
  document.getElementById('dp-body').innerHTML = html;
  document.getElementById('dp-footer').style.display = 'none';
}

function saveVehicle() {
  const name   = document.getElementById('veh-f-name').value.trim();
  const type   = document.getElementById('veh-f-type').value;
  const plate  = document.getElementById('veh-f-plate').value.trim()||'—';
  const assigned = document.getElementById('veh-f-assigned').value.trim()||'Unassigned';
  const status = document.getElementById('veh-f-status').value;
  const nextMaint = document.getElementById('veh-f-maint').value||'';
  const year   = parseInt(document.getElementById('veh-f-year').value)||new Date().getFullYear();
  const orcr   = document.getElementById('veh-f-orcr').value||'—';
  if (!name) { showToast('Vehicle name required','t-error'); return; }
  vehicles.push({ id:vehId++, name,type,plate,assigned,status,nextMaint,year,orcr,maintHistory:[] });
  closeM('m-add-veh');
  clearForm(['veh-f-name','veh-f-plate','veh-f-assigned','veh-f-maint','veh-f-year','veh-f-orcr']);
  addLog('CREATE','Vehicles',`Added vehicle: "${name}" (${plate})`,plate);
  renderVehicles(); showToast(`"${name}" added`,'t-success');
}

function openVehMaint(id) {
  const v = vehicles.find(x => x.id === id);
  if (!v) return;
  currentVehId = id;
  document.getElementById('veh-maint-name').textContent = v.name;
  document.getElementById('vm-date').value = todayStr();
  document.getElementById('vm-odo').value  = '';
  document.getElementById('vm-cost').value = '';
  document.getElementById('vm-next').value = '';
  document.getElementById('vm-remarks').value = '';
  openM('m-veh-maint');
}

function saveVehicleMaint() {
  const v = vehicles.find(x => x.id === currentVehId);
  if (!v) return;
  const date    = document.getElementById('vm-date').value;
  const odo     = parseInt(document.getElementById('vm-odo').value)||0;
  const type    = document.getElementById('vm-type').value;
  const cost    = parseFloat(document.getElementById('vm-cost').value)||0;
  const next    = document.getElementById('vm-next').value;
  const remarks = document.getElementById('vm-remarks').value.trim();
  if (!v.maintHistory) v.maintHistory = [];
  v.maintHistory.push({ date,odo,type,cost,next,remarks });
  if (next) v.nextMaint = next;
  if (v.status === 'For Maintenance') v.status = 'Active';
  closeM('m-veh-maint');
  addLog('UPDATE','Vehicles',`Maintenance: "${v.name}" — ${type}. Next: ${next||'TBD'}`,v.plate);
  renderVehicles();
  if (dpOpen && dpCurrentType==='vehicle' && dpCurrentId===v.id) dpVehicle(v.id);
  showToast(`Maintenance saved for ${v.name}`,'t-success');
}

function deleteVeh(id) {
  const v = vehicles.find(x => x.id === id);
  if (!v || !confirm(`Delete "${v.name}"?`)) return;
  vehicles = vehicles.filter(x => x.id !== id);
  addLog('DELETE','Vehicles',`Deleted vehicle: "${v.name}" (${v.plate})`,v.plate);
  closeDP(); renderVehicles(); showToast('Vehicle deleted','t-warning');
}

/* ──────────────────────────────────────────────────────────────
   GLOBE MOBILE PLANS
────────────────────────────────────────────────────────────── */
let globePlans = [
  { id:1, name:'Maria Alonzo',   num:'0917-123-4567', acct:'GLOBE-ACC-001', plan:'Globe Postpaid Plan 999', cost:999,  data:'50GB',  credit:1500, renew:'2026-06-01', status:'Active',   remarks:'Admin line.' },
  { id:2, name:'Juan Reyes',     num:'0917-234-5678', acct:'GLOBE-ACC-002', plan:'Globe Postpaid Plan 799', cost:799,  data:'30GB',  credit:1000, renew:'2026-06-01', status:'Active',   remarks:'' },
  { id:3, name:'Ana Cruz',       num:'0917-345-6789', acct:'GLOBE-ACC-003', plan:'Globe Postpaid Plan 599', cost:599,  data:'20GB',  credit:800,  renew:'2026-05-25', status:'Active',   remarks:'Renewal in 3 days.' },
  { id:4, name:'Carlos Santos',  num:'0918-456-7890', acct:'GLOBE-ACC-004', plan:'Globe Postpaid Plan 999', cost:999,  data:'50GB',  credit:1500, renew:'2026-07-01', status:'Active',   remarks:'' },
  { id:5, name:'Rosa Flores',    num:'0917-567-8901', acct:'GLOBE-ACC-005', plan:'Globe Postpaid Plan 399', cost:399,  data:'10GB',  credit:500,  renew:'2025-12-01', status:'For Renewal',remarks:'Lapsed. Contact Globe.' },
];
let globeId = 6;

function renderGlobe() {
  const tbody = document.getElementById('globe-tbody');
  tbody.innerHTML = '';
  let renewSoon = 0;
  const now = new Date(); now.setHours(0,0,0,0);
  globePlans.forEach(g => {
    const renewDate = new Date(g.renew);
    const daysLeft  = Math.ceil((renewDate - now) / 86400000);
    if (daysLeft <= 30 && g.status !== 'Inactive') renewSoon++;
    const sCls = g.status==='Active'?'b-green':g.status==='For Renewal'?'b-red':'b-slate';
    const tr = document.createElement('tr');
    tr.className = 'tr-clickable';
    tr.innerHTML = `
      <td class="td-strong">${g.name}</td>
      <td class="td-mono">${g.num}</td>
      <td>${g.plan}</td>
      <td>₱${g.cost.toLocaleString()}/mo</td>
      <td class="td-mono">${g.renew}</td>
      <td>${badge(g.status, sCls)}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();editGlobe(${g.id})">✏️</button>
          <button class="btn btn-xs btn-red" onclick="event.stopPropagation();deleteGlobe(${g.id})">🗑️</button>
        </div>
      </td>`;
    tr.addEventListener('click', () => openDP('globe', g.id, tr));
    tbody.appendChild(tr);
  });
  document.getElementById('globe-ct').textContent        = `${globePlans.length} plans`;
  document.getElementById('globe-renew-ct').textContent  = `${renewSoon} renewing soon`;
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
  const name   = document.getElementById('globe-f-name').value.trim();
  const num    = document.getElementById('globe-f-num').value.trim()||'—';
  const acct   = document.getElementById('globe-f-acct').value.trim()||'—';
  const plan   = document.getElementById('globe-f-plan').value.trim()||'—';
  const cost   = parseFloat(document.getElementById('globe-f-cost').value)||0;
  const data   = document.getElementById('globe-f-data').value.trim()||'—';
  const renew  = document.getElementById('globe-f-renew').value||'—';
  const credit = parseFloat(document.getElementById('globe-f-credit').value)||0;
  const remarks= document.getElementById('globe-f-remarks').value.trim();
  if (!name) { showToast('Employee name required','t-error'); return; }
  globePlans.push({ id:globeId++, name,num,acct,plan,cost,data,renew,credit,status:'Active',remarks });
  closeM('m-add-globe');
  clearForm(['globe-f-name','globe-f-num','globe-f-acct','globe-f-plan','globe-f-cost','globe-f-data','globe-f-renew','globe-f-credit','globe-f-remarks']);
  addLog('CREATE','Globe Mobile Plans',`Added mobile plan for ${name}: ${plan}`,acct);
  renderGlobe(); showToast(`Plan added for ${name}`,'t-success');
}

function editGlobe(id) {
  const g = globePlans.find(x => x.id === id);
  if (!g) return;
  document.getElementById('globe-f-name').value    = g.name;
  document.getElementById('globe-f-num').value     = g.num;
  document.getElementById('globe-f-acct').value    = g.acct;
  document.getElementById('globe-f-plan').value    = g.plan;
  document.getElementById('globe-f-cost').value    = g.cost;
  document.getElementById('globe-f-data').value    = g.data;
  document.getElementById('globe-f-renew').value   = g.renew;
  document.getElementById('globe-f-credit').value  = g.credit;
  document.getElementById('globe-f-remarks').value = g.remarks||'';
  globePlans = globePlans.filter(x => x.id !== id);
  openM('m-add-globe');
}

function deleteGlobe(id) {
  const g = globePlans.find(x => x.id === id);
  if (!g || !confirm(`Delete plan for "${g.name}"?`)) return;
  globePlans = globePlans.filter(x => x.id !== id);
  addLog('DELETE','Globe Mobile Plans',`Deleted plan for ${g.name}`,g.acct);
  closeDP(); renderGlobe(); showToast('Plan deleted','t-warning');
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
  logs.unshift({
    id: logId++,
    ts: new Date().toLocaleString('en-PH',{hour12:true}),
    user: currentUser ? currentUser.name : 'System',
    action, module, desc, ref,
  });
  renderLogs();
}

function renderLogs() {
  const tbody = document.getElementById('log-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  logs.forEach(l => {
    const clsMap = {CREATE:'la-create',UPDATE:'la-update',DELETE:'la-delete',DELIVER:'la-deliver',WITHDRAW:'la-withdraw',LOGIN:'la-system',LOGOUT:'la-system',SYSTEM:'la-system'};
    const cls = clsMap[l.action]||'la-system';
    const tr = document.createElement('tr');
    tr.className = 'tr-clickable';
    tr.innerHTML = `
      <td class="td-mono" style="font-size:11px">${l.ts}</td>
      <td>${l.user}</td>
      <td><span class="log-action-badge ${cls}">${LOG_ICONS[l.action]||'📝'} ${l.action}</span></td>
      <td><span class="badge b-slate b-none">${l.module}</span></td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px">${l.desc}</td>
      <td class="td-mono">${l.ref}</td>`;
    tr.addEventListener('click', () => openDP('log', l.id, tr));
    tbody.appendChild(tr);
  });
  document.getElementById('log-ct').textContent = `${logs.length} entries`;
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
  const lowInv = items.filter(i => i.current_quantity <= i.reorder_level).length;
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
  const lowItems = items.filter(i => i.current_quantity <= i.reorder_level).slice(0,5);
  document.getElementById('dash-low-list').innerHTML = lowItems.length
    ? lowItems.map(i => `<div class="panel-row"><div class="pr-dot ${i.current_quantity===0?'red':'amber'}"></div><div><div class="pr-name">${i.item_name}</div><div class="pr-meta">${i.category} · Qty: ${i.current_quantity} / Reorder: ${i.reorder_level}</div></div>${badge(i.current_quantity===0?'Critical':'Low Stock',i.current_quantity===0?'b-red':'b-amber')}</div>`).join('')
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

function updateUserUI() {
  const initials = currentUser.initials || (currentUser.name || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  const roleTitle = currentUser.role === 'admin' ? 'Administrator' : currentUser.department || 'Employee';
  ['sb-avatar','tb-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initials;
  });
  ['sb-uname','tb-uname'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = currentUser.name || '';
  });
  const roleTag = document.getElementById('sb-role-tag');
  const rolePill = document.getElementById('tb-role-pill');
  if (roleTag) roleTag.textContent = currentUser.role === 'admin' ? 'Admin' : 'Employee';
  if (rolePill) rolePill.textContent = roleTitle;
}

function initApp() {
  updateUserUI();
  buildSidebar();
  navigate('dashboard', document.getElementById('nav-dashboard'));
  initAllModules();
  addLog('LOGIN', 'Auth', `${currentUser.name} signed in as ${currentUser.role}`, currentUser.user_id);
}




// Duplicate backend log renderer removed by renaming

async function renderLogsApi() {
  const res = await fetch(`${API_URL}/api/logs`);
  const logs = await res.json();

  const tbody = document.getElementById("log-tbody");
  tbody.innerHTML = "";

  logs.forEach(log => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${new Date(log.date_time).toLocaleString()}</td>
      <td>${log.user_id || "User"}</td>
      <td>${log.action_type}</td>
      <td>${log.module}</td>
      <td>${log.description}</td>
      <td>${log.reference_type || "-"}</td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("log-ct").innerText =
    logs.length + " entries";
}