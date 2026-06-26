// ============================================================
// main_constants.js — Navigation config & DP router
// Paste these CONSTANTS into the top of main.js, replacing
// existing ADMIN_NAV, EMP_NAV, PAGE_META definitions.
//
// CHANGES:
//  - Removed globe, m365, master-subscriptions from nav
//  - Single "subscriptions" entry covers all three
//  - insurance dpType added to openDP renderer map
//  - editState declared properly (was accidental global)
// ============================================================

/* ── NAV ITEMS ──────────────────────────────────────────── */
const ADMIN_NAV = [
  { id: "dashboard",     icon: "🏠", label: "Dashboard"           },
  { id: "inventory",     icon: "📦", label: "Inventory Management", badge: "inv" },
  { id: "orders",        icon: "🛒", label: "Purchase Orders",     badge: "po"  },
  { id: "furniture",     icon: "🪑", label: "Office Furniture"     },
  { id: "itsupplies",    icon: "🖨️", label: "IT Supplies",         badge: "it"  },
  { id: "laptops",       icon: "💻", label: "Laptops"              },
  { id: "vehicles",      icon: "🚗", label: "Vehicle Management"   },
  { id: "contracts",     icon: "📄", label: "Contracts"            },
  // ✅ CHANGE: globe, m365, subscriptions, master-subscriptions
  //           replaced with ONE unified subscriptions entry
  { id: "subscriptions", icon: "🔐", label: "Subscriptions",       admin: true  },
  { id: "insurance",     icon: "🛡️", label: "Insurance",           admin: true  },
  { id: "finance",       icon: "📁", label: "Finance Documents",   admin: true  },
  { id: "logs",          icon: "📜", label: "System Logs",         admin: true  },
  { id: "users",         icon: "👤", label: "Users",               admin: true  },
];

// Pages accessible to non-admin roles
const EMP_NAV = [
  "dashboard","inventory","orders","furniture",
  "itsupplies","laptops","vehicles","contracts","subscriptions"
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
const DP_RENDERERS = {
  inventory:     dpInventory,
  furniture:     dpFurniture,
  order:         dpOrder,
  itsupplies:    dpITSupplies,
  laptop:        dpLaptop,
  vehicle:       dpVehicle,
  contracts:     dpContract,
  subscriptions: dpSubscriptions,
  globe:         dpGlobe,
  m365:          dpM365,
  insurance:     dpInsurance,   // ✅ NEW
  finance:       dpFinance,
  log:           dpLog,
};

// Replace the openDP function in main.js with this cleaner version:
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

