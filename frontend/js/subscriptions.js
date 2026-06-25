/* ============================================================
   subscriptions.js  — REFACTORED FRONTEND MODULE
   Covers: M365 · Globe · Subscriptions · Attachments
   Replace the relevant sections in main.js with these.
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   SHARED HELPERS
────────────────────────────────────────────────────────── */

/**
 * Fetch a SINGLE record by ID instead of fetching all + .find().
 * Usage: const m = await fetchOne("m365", id);
 */
async function fetchOne(module, id) {
  const apiMap = {
    m365:          "m365",
    globe:         "globe",
    subscriptions: "subscriptions",
  };
  const endpoint = apiMap[module] || module;
  const res = await fetch(`${API_URL}/api/${endpoint}/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch ${module} #${id}`);
  return res.json();
}

/**
 * Unified status badge renderer.
 * Works for all three subscription modules.
 */
function statusBadge(status) {
  const map = {
    "Active":        "b-green",
    "For Renewal":   "b-amber",
    "Expiring Soon": "b-amber",
    "Expired":       "b-red",
    "Inactive":      "b-slate",
    "Cancelled":     "b-slate",
  };
  const cls = map[status] || "b-slate";
  return `<span class="badge ${cls}">${status || "—"}</span>`;
}

/**
 * Format a date string for display (or return "—").
 */
function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

/**
 * Format currency.
 */
function fmtCost(val) {
  if (!val && val !== 0) return "—";
  return "₱" + Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 });
}












/* ──────────────────────────────────────────────────────────
   M365 LICENSES
────────────────────────────────────────────────────────── */

let m365EditId = null;

async function renderM365() {
  try {
    const data = await (await fetch(`${API_URL}/api/m365`)).json();

    const tbody = document.getElementById("m365-tbody");
    tbody.innerHTML = "";

    let expiredCount = 0;

    data.forEach(m => {
      const status = m.computed_status || m.status;
      if (status === "Expired") expiredCount++;

      const tr = document.createElement("tr");
      tr.className = "tr-clickable";
      tr.dataset.id = m.license_id;

      tr.innerHTML = `
        <td>${m.assigned_email}</td>
        <td>${m.license_type || "—"}</td>
        <td>${m.category || "—"}</td>
        <td>${fmtDate(m.expiry_date)}</td>
        <td>${fmtCost(m.monthly_cost ?? m.license_cost)}</td>
        <td>${statusBadge(status)}</td>
        <td>
          <div class="flex-gap">
            <button class="btn btn-xs btn-outline"
              onclick="event.stopPropagation(); editM365(${m.license_id})">
              ✏️
            </button>
            <button class="btn btn-xs btn-red"
              onclick="event.stopPropagation(); deleteM365Prompt(${m.license_id})">
              🗑️
            </button>
          </div>
        </td>
      `;

      tr.addEventListener("click", () => openDP("m365", m.license_id, tr));
      tbody.appendChild(tr);
    });

    document.getElementById("m365-exp-ct").textContent = `${expiredCount} expired`;
    document.getElementById("m365-ct").textContent     = `${data.length} licenses`;
  } catch (err) {
    console.error("renderM365:", err);
    showToast("Failed to load M365 licenses", "t-error");
  }
}

async function dpM365(id) {
  try {
    const m = await fetchOne("m365", id);         // ← single-record fetch
    const status = m.computed_status || m.status;

    setDPHeader("💼", "#f0f9ff", m.assigned_email, "M365 License");

    const html = `
      <div class="dp-status-row">
        ${statusBadge(status)}
        <span class="dp-status-label">License status</span>
      </div>

      <div class="dp-section">
        <div class="dp-section-hd">📧 License Info</div>
        <div class="dp-grid">
          ${dpField("Assigned Email", m.assigned_email)}
          ${dpField("Assigned User", m.assigned_user_name || "—")}
          ${dpField("License Type", m.license_type || "—")}
          ${dpField("Category", m.category || "—")}
          ${dpField("Monthly Cost", fmtCost(m.monthly_cost ?? m.license_cost))}
          ${dpField("Status", statusBadge(status))}
        </div>
      </div>

      <div class="dp-section">
        <div class="dp-section-hd">📅 Dates</div>
        <div class="dp-grid">
          ${dpField("Start Date",   fmtDate(m.start_date))}
          ${dpField("Expiry Date",  fmtDate(m.expiry_date))}
          ${dpField("Renewal Date", fmtDate(m.renewal_date))}
        </div>
      </div>

      ${m.remarks ? `
        <div class="dp-section">
          <div class="dp-section-hd">📝 Remarks</div>
          <div class="dp-grid">${dpFieldFull("Notes", m.remarks)}</div>
        </div>
      ` : ""}

      <div class="dp-section" id="dp-attachments-m365-${id}">
        <!-- Attachments rendered by attachmentPanel() -->
      </div>

      ${isAdminUser() ? `
        <div class="dp-section">
          <div class="dp-section-hd">⚡ Actions</div>
          <div class="dp-action-row">
            <button class="btn btn-primary btn-sm" onclick="editM365(${m.license_id})">
              ✏️ Edit
            </button>
            <button class="btn btn-red btn-sm" onclick="deleteM365Prompt(${m.license_id})">
              🗑️ Delete
            </button>
          </div>
        </div>
      ` : ""}
    `;

    document.getElementById("dp-body").innerHTML = html;
    document.getElementById("dp-footer").style.display = "none";

    // Load attachments after panel is in DOM
    attachmentPanel("m365", id, `dp-attachments-m365-${id}`);
  } catch (err) {
    console.error("dpM365:", err);
    showToast("Failed to load license", "t-error");
  }
}

function saveM365() {
  const email   = document.getElementById("m365-f-email").value.trim();
  const type    = document.getElementById("m365-f-type").value;
  const cat     = document.getElementById("m365-f-cat").value;
  const start   = document.getElementById("m365-f-start").value;
  const expiry  = document.getElementById("m365-f-expiry").value;
  const renewal = document.getElementById("m365-f-renew").value;
  const cost    = parseFloat(document.getElementById("m365-f-cost").value) || null;
  const remarks = document.getElementById("m365-f-remarks").value;

  if (!email || !type || !cat) {
    showToast("Email, license type, and category are required", "t-error");
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    showToast("Invalid email format", "t-error");
    return;
  }

  const payload = {
    assigned_email: email,
    license_type:   type,
    category:       cat,
    monthly_cost:   cost,
    start_date:     start   || null,
    expiry_date:    expiry  || null,
    renewal_date:   renewal || null,
    status:         "Active",
    remarks,
  };

  const url    = m365EditId ? `${API_URL}/api/m365/${m365EditId}` : `${API_URL}/api/m365`;
  const method = m365EditId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    return res.json();
  })
  .then(record => {
    showToast(m365EditId ? "License updated" : "License added", "t-success");
    addLog(
      m365EditId ? "UPDATE" : "CREATE",
      "M365 LICENSE",
      `${m365EditId ? "Updated" : "Added"} M365 license: ${email}`,
      record.license_id
    );
    m365EditId = null;
    closeM("m-add-m365");
    renderM365();
    if (dpCurrentType === "m365") dpM365(dpCurrentId);
  })
  .catch(err => {
    console.error(err);
    showToast(err.message || "Failed to save license", "t-error");
  });
}

async function editM365(id) {
  try {
    const m = await fetchOne("m365", id);
    m365EditId = id;

    document.getElementById("m365-f-email").value  = m.assigned_email || "";
    document.getElementById("m365-f-type").value   = m.license_type   || "";
    document.getElementById("m365-f-cat").value    = m.category       || "";
    document.getElementById("m365-f-cost").value   = m.monthly_cost ?? m.license_cost ?? "";
    document.getElementById("m365-f-remarks").value= m.remarks        || "";
    document.getElementById("m365-f-start").value  = m.start_date   ? new Date(m.start_date).toISOString().slice(0,10)   : "";
    document.getElementById("m365-f-expiry").value = m.expiry_date  ? new Date(m.expiry_date).toISOString().slice(0,10)  : "";
    document.getElementById("m365-f-renew").value  = m.renewal_date ? new Date(m.renewal_date).toISOString().slice(0,10) : "";

    openM("m-add-m365");
  } catch (err) {
    showToast("Failed to load license for editing", "t-error");
  }
}

let deleteM365Id = null;

function deleteM365Prompt(id) {
  deleteM365Id = id;
  openM("m-confirm-m365-del");
}

function confirmDeleteM365() {
  fetch(`${API_URL}/api/m365/${deleteM365Id}`, { method: "DELETE" })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    showToast("License deleted", "t-warning");
    addLog("DELETE", "M365 LICENSE", `Deleted M365 license #${deleteM365Id}`, deleteM365Id);
    closeM("m-confirm-m365-del");
    closeDP();
    renderM365();
  })
  .catch(err => showToast(err.message || "Delete failed", "t-error"));
}












/* ──────────────────────────────────────────────────────────
   GLOBE MOBILE PLANS
────────────────────────────────────────────────────────── */

let globeEditId = null;
let globeUserMap = {};

async function renderGlobe() {
  try {
    const data = await (await fetch(`${API_URL}/api/globe`)).json();

    const tbody = document.getElementById("globe-tbody");
    tbody.innerHTML = "";

    let renewSoon = 0;

    data.forEach(g => {
      const status = g.computed_status || g.status;
      if (status === "For Renewal") renewSoon++;

      const tr = document.createElement("tr");
      tr.className = "tr-clickable";

      tr.innerHTML = `
        <td>${g.employee_name || "—"}</td>
        <td>${g.mobile_number || "—"}</td>
        <td>${g.plan_name     || "—"}</td>
        <td>${fmtCost(g.monthly_cost)}</td>
        <td>${fmtDate(g.renewal_date)}</td>
        <td>${statusBadge(status)}</td>
        <td>
          <div class="flex-gap">
            <button class="btn btn-xs btn-outline"
              onclick="event.stopPropagation(); editGlobe(${g.plan_id})">✏️</button>
            <button class="btn btn-xs btn-red"
              onclick="event.stopPropagation(); deleteGlobePrompt(${g.plan_id})">🗑️</button>
          </div>
        </td>
      `;

      tr.addEventListener("click", () => openDP("globe", g.plan_id, tr));
      tbody.appendChild(tr);
    });

    document.getElementById("globe-renew-ct").textContent = `${renewSoon} renewing soon`;
    document.getElementById("globe-ct").textContent       = `${data.length} plans`;
  } catch (err) {
    console.error("renderGlobe:", err);
    showToast("Failed to load Globe plans", "t-error");
  }
}

async function dpGlobe(id) {
  try {
    const g      = await fetchOne("globe", id);
    const status = g.computed_status || g.status;

    setDPHeader("📱", "#f0fdf4", g.employee_name || "—", "Globe Mobile Plan");

    const html = `
      <div class="dp-status-row">
        ${statusBadge(status)}
        <span class="dp-status-label">Plan status</span>
      </div>

      <div class="dp-section">
        <div class="dp-section-hd">👤 Subscriber</div>
        <div class="dp-grid">
          ${dpField("Employee",   g.employee_name  || "—")}
          ${dpField("Mobile No.", g.mobile_number  || "—")}
          ${dpField("Account No.",g.account_number || "—")}
        </div>
      </div>

      <div class="dp-section">
        <div class="dp-section-hd">📱 Plan Details</div>
        <div class="dp-grid">
          ${dpField("Plan Name",    g.plan_name      || "—")}
          ${dpField("Monthly Cost", fmtCost(g.monthly_cost))}
          ${dpField("Data",         g.data_allocation || "—")}
          ${dpField("Credit Limit", fmtCost(g.credit_limit))}
          ${dpField("Start Date",   fmtDate(g.start_date))}
          ${dpField("Renewal Date", fmtDate(g.renewal_date))}
        </div>
      </div>

      ${g.remarks ? `
        <div class="dp-section">
          <div class="dp-section-hd">📝 Remarks</div>
          <div class="dp-grid">${dpFieldFull("Notes", g.remarks)}</div>
        </div>
      ` : ""}

      <div class="dp-section" id="dp-attachments-globe-${id}">
        <!-- Attachments rendered by attachmentPanel() -->
      </div>

      <div class="dp-section">
        <div class="dp-section-hd">⚡ Actions</div>
        <div class="dp-action-row">
          <button class="btn btn-primary btn-sm" onclick="editGlobe(${g.plan_id})">✏️ Edit</button>
          <button class="btn btn-red btn-sm"     onclick="deleteGlobePrompt(${g.plan_id})">🗑️ Delete</button>
        </div>
      </div>
    `;

    document.getElementById("dp-body").innerHTML = html;
    document.getElementById("dp-footer").style.display = "none";

    attachmentPanel("globe", id, `dp-attachments-globe-${id}`);
  } catch (err) {
    console.error("dpGlobe:", err);
    showToast("Failed to load Globe plan", "t-error");
  }
}

function saveGlobe() {
  const userName = document.getElementById("globe-f-user").value;
  const mobile   = document.getElementById("globe-f-num").value.trim();
  const plan     = document.getElementById("globe-f-plan").value.trim();
  const renew    = document.getElementById("globe-f-renew").value;

  if (!mobile || !plan || !renew) {
    showToast("Mobile number, plan name, and renewal date are required", "t-error");
    return;
  }
  if (!selectState["globe-f-user"]) {
    showToast("Select a valid employee", "t-error");
    return;
  }

  const mobilePattern = /^09\d{2}-\d{3}-\d{4}$/;
  if (mobile && !mobilePattern.test(mobile)) {
    showToast("Invalid mobile format (e.g. 0917-123-4567)", "t-error");
    return;
  }

  const payload = {
    user_id:        globeUserMap[userName] || null,
    mobile_number:  mobile,
    account_number: document.getElementById("globe-f-acct").value,
    plan_name:      plan,
    data_allocation:document.getElementById("globe-f-data").value,
    monthly_cost:   document.getElementById("globe-f-cost").value || null,
    credit_limit:   document.getElementById("globe-f-credit").value || null,
    start_date:     document.getElementById("globe-f-start").value || null,
    renewal_date:   renew,
    status:         document.getElementById("globe-f-status").value,
    remarks:        document.getElementById("globe-f-remarks").value,
  };

  const url    = globeEditId ? `${API_URL}/api/globe/${globeEditId}` : `${API_URL}/api/globe`;
  const method = globeEditId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    return res.json();
  })
  .then(record => {
    showToast(globeEditId ? "Plan updated" : "Plan added", "t-success");
    addLog(
      globeEditId ? "UPDATE" : "CREATE",
      "GLOBE PLAN",
      `${globeEditId ? "Updated" : "Added"} Globe plan for ${userName}`,
      record.plan_id
    );
    globeEditId = null;
    closeM("m-add-globe");
    renderGlobe();
    if (dpCurrentType === "globe") dpGlobe(dpCurrentId);
  })
  .catch(err => showToast(err.message || "Failed to save plan", "t-error"));
}

async function editGlobe(id) {
  try {
    const g = await fetchOne("globe", id);
    globeEditId = id;

    await loadGlobeUsers();

    document.getElementById("globe-f-user").value   = g.employee_name  || "";
    selectState["globe-f-user"] = true;
    document.getElementById("globe-f-num").value    = g.mobile_number  || "";
    document.getElementById("globe-f-acct").value   = g.account_number || "";
    document.getElementById("globe-f-plan").value   = g.plan_name      || "";
    document.getElementById("globe-f-cost").value   = g.monthly_cost   || "";
    document.getElementById("globe-f-data").value   = g.data_allocation|| "";
    document.getElementById("globe-f-credit").value = g.credit_limit   || "";
    document.getElementById("globe-f-remarks").value= g.remarks        || "";
    document.getElementById("globe-f-status").value = g.status         || "Active";
    document.getElementById("globe-f-start").value  = g.start_date   ? new Date(g.start_date).toISOString().slice(0,10)   : "";
    document.getElementById("globe-f-renew").value  = g.renewal_date ? new Date(g.renewal_date).toISOString().slice(0,10) : "";

    openM("m-add-globe");
  } catch (err) {
    showToast("Failed to load plan for editing", "t-error");
  }
}

let deleteGlobeId = null;

function deleteGlobePrompt(id) {
  deleteGlobeId = id;
  openM("m-confirm-globe-del");
}

function confirmDeleteGlobe() {
  fetch(`${API_URL}/api/globe/${deleteGlobeId}`, { method: "DELETE" })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    showToast("Plan deleted", "t-warning");
    addLog("DELETE", "GLOBE PLAN", `Deleted Globe plan #${deleteGlobeId}`, deleteGlobeId);
    closeM("m-confirm-globe-del");
    closeDP();
    renderGlobe();
  })
  .catch(err => showToast(err.message || "Delete failed", "t-error"));
}

async function loadGlobeUsers() {
  const res   = await fetch(`${API_URL}/api/auth/users`);
  const users = await res.json();
  const names = users.map(u => u.name);

  makeSearchable("globe-f-user", "globe-f-user-list", names);

  globeUserMap = {};
  users.forEach(u => { globeUserMap[u.name] = u.user_id; });
}

function openAddGlobe() {
  globeEditId = null;
  openM("m-add-globe");
  loadGlobeUsers();
}












/* ──────────────────────────────────────────────────────────
   SUBSCRIPTIONS
────────────────────────────────────────────────────────── */

let subEditId = null;

const SUB_CATEGORIES = [
  "Software", "Security", "Communications", "Cloud Storage",
  "Productivity", "Design", "Marketing", "Other",
];

async function renderSubscriptions() {
  try {
    const data = await (await fetch(`${API_URL}/api/subscriptions`)).json();

    const tbody = document.getElementById("sub-tbody");
    tbody.innerHTML = "";

    data.forEach(s => {
      const status = s.computed_status || s.status;

      const tr = document.createElement("tr");
      tr.className = "tr-clickable";

      tr.innerHTML = `
        <td>${s.subscription_name}</td>
        <td>${s.category}</td>
        <td>${s.assigned_to || s.assigned_user_name || "—"}</td>
        <td>${s.supplier || "—"}</td>
        <td>${fmtCost(s.monthly_cost)}</td>
        <td>${fmtDate(s.expiry_date)}</td>
        <td>${statusBadge(status)}</td>
        <td>
          <div class="flex-gap">
            <button class="btn btn-xs btn-outline"
              onclick="event.stopPropagation(); editSubscription(${s.subscription_id})">✏️</button>
            <button class="btn btn-xs btn-red"
              onclick="event.stopPropagation(); deleteSubPrompt(${s.subscription_id})">🗑️</button>
          </div>
        </td>
      `;

      tr.addEventListener("click", () => openDP("subscriptions", s.subscription_id, tr));
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("renderSubscriptions:", err);
    showToast("Failed to load subscriptions", "t-error");
  }
}

async function dpSubscriptions(id) {
  try {
    const s      = await fetchOne("subscriptions", id);
    const status = s.computed_status || s.status;

    setDPHeader("🔐", "#fdf4ff", s.subscription_name, s.category);

    const html = `
      <div class="dp-status-row">
        ${statusBadge(status)}
        <span class="dp-status-label">Subscription status</span>
      </div>

      <div class="dp-section">
        <div class="dp-section-hd">📋 Details</div>
        <div class="dp-grid">
          ${dpField("Name",         s.subscription_name)}
          ${dpField("Category",     s.category)}
          ${dpField("Supplier",     s.supplier     || "—")}
          ${dpField("Assigned To",  s.assigned_user_name || s.assigned_to || "—")}
          ${dpField("Monthly Cost", fmtCost(s.monthly_cost))}
          ${dpField("Billing",      s.billing_cycle || "—")}
        </div>
      </div>

      <div class="dp-section">
        <div class="dp-section-hd">📅 Dates</div>
        <div class="dp-grid">
          ${dpField("Start Date",  fmtDate(s.start_date))}
          ${dpField("Expiry Date", fmtDate(s.expiry_date))}
        </div>
      </div>

      ${s.remarks ? `
        <div class="dp-section">
          <div class="dp-section-hd">📝 Remarks</div>
          <div class="dp-grid">${dpFieldFull("Notes", s.remarks)}</div>
        </div>
      ` : ""}

      <div class="dp-section" id="dp-attachments-sub-${id}">
        <!-- Attachments -->
      </div>

      ${isAdminUser() ? `
        <div class="dp-section">
          <div class="dp-section-hd">⚡ Actions</div>
          <div class="dp-action-row">
            <button class="btn btn-primary btn-sm" onclick="editSubscription(${s.subscription_id})">✏️ Edit</button>
            <button class="btn btn-red btn-sm"     onclick="deleteSubPrompt(${s.subscription_id})">🗑️ Delete</button>
          </div>
        </div>
      ` : ""}
    `;

    document.getElementById("dp-body").innerHTML = html;
    document.getElementById("dp-footer").style.display = "none";

    attachmentPanel("subscriptions", id, `dp-attachments-sub-${id}`);
  } catch (err) {
    console.error("dpSubscriptions:", err);
    showToast("Failed to load subscription", "t-error");
  }
}

function saveSubscription() {
  const name     = document.getElementById("sub-f-name").value.trim();
  const category = document.getElementById("sub-f-cat").value;
  const supplier = document.getElementById("sub-f-supplier").value.trim();
  const assigned = document.getElementById("sub-f-assigned").value.trim();
  const cost     = document.getElementById("sub-f-cost").value || null;
  const cycle    = document.getElementById("sub-f-cycle").value;
  const start    = document.getElementById("sub-f-start").value || null;
  const expiry   = document.getElementById("sub-f-expiry").value || null;
  const status   = document.getElementById("sub-f-status").value;
  const remarks  = document.getElementById("sub-f-remarks").value;

  if (!name || !category) {
    showToast("Subscription name and category are required", "t-error");
    return;
  }

  const payload = {
    subscription_name: name,
    category,
    supplier:     supplier  || null,
    assigned_to:  assigned  || null,
    monthly_cost: cost,
    billing_cycle: cycle,
    start_date:   start,
    expiry_date:  expiry,
    status,
    remarks,
  };

  const url    = subEditId ? `${API_URL}/api/subscriptions/${subEditId}` : `${API_URL}/api/subscriptions`;
  const method = subEditId ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    return res.json();
  })
  .then(record => {
    showToast(subEditId ? "Subscription updated" : "Subscription added", "t-success");
    addLog(
      subEditId ? "UPDATE" : "CREATE",
      "SUBSCRIPTION",
      `${subEditId ? "Updated" : "Added"} subscription: ${name}`,
      record.subscription_id
    );
    subEditId = null;
    closeM("m-sub-add");
    renderSubscriptions();
    if (dpCurrentType === "subscriptions") dpSubscriptions(dpCurrentId);
  })
  .catch(err => showToast(err.message || "Failed to save subscription", "t-error"));
}

async function editSubscription(id) {
  try {
    const s = await fetchOne("subscriptions", id);
    subEditId = id;

    document.getElementById("sub-f-name").value     = s.subscription_name || "";
    document.getElementById("sub-f-cat").value      = s.category          || "";
    document.getElementById("sub-f-supplier").value = s.supplier          || "";
    document.getElementById("sub-f-assigned").value = s.assigned_to       || s.assigned_user_name || "";
    document.getElementById("sub-f-cost").value     = s.monthly_cost      || "";
    document.getElementById("sub-f-cycle").value    = s.billing_cycle     || "monthly";
    document.getElementById("sub-f-start").value    = s.start_date  ? new Date(s.start_date).toISOString().slice(0,10)  : "";
    document.getElementById("sub-f-expiry").value   = s.expiry_date ? new Date(s.expiry_date).toISOString().slice(0,10) : "";
    document.getElementById("sub-f-status").value   = s.status            || "Active";
    document.getElementById("sub-f-remarks").value  = s.remarks           || "";

    openM("m-sub-add");
  } catch (err) {
    showToast("Failed to load subscription for editing", "t-error");
  }
}

let deleteSubId = null;

function deleteSubPrompt(id) {
  deleteSubId = id;
  openM("m-confirm-sub-del");
}

function confirmDeleteSubscription() {
  fetch(`${API_URL}/api/subscriptions/${deleteSubId}`, { method: "DELETE" })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    showToast("Subscription deleted", "t-warning");
    addLog("DELETE", "SUBSCRIPTION", `Deleted subscription #${deleteSubId}`, deleteSubId);
    closeM("m-confirm-sub-del");
    closeDP();
    renderSubscriptions();
  })
  .catch(err => showToast(err.message || "Delete failed", "t-error"));
}












/* ──────────────────────────────────────────────────────────
   ATTACHMENT SYSTEM  (standardized, works for all modules)
────────────────────────────────────────────────────────── */

/**
 * Render a self-contained attachments panel into the target element.
 * Call this from any dpXxx() function after setting innerHTML.
 *
 * @param {string} module     - e.g. "m365" | "globe" | "subscriptions"
 * @param {number} recordId   - the PK of the record
 * @param {string} containerId - the DOM id to render into
 */
async function attachmentPanel(module, recordId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // ── Skeleton while loading ──────────────────────────────
  container.innerHTML = `
    <div class="dp-section-hd">📎 Attachments</div>
    <div style="color:var(--slate-400);font-size:12px;padding:8px 0">Loading…</div>
  `;

  try {
    const res  = await fetch(`${API_URL}/api/attachments/${module}/${recordId}`);
    const list = await res.json();

    _renderAttachmentPanel(container, module, recordId, list);
  } catch (err) {
    container.innerHTML += `<div style="color:var(--red-500);font-size:12px">Failed to load attachments</div>`;
  }
}

function _renderAttachmentPanel(container, module, recordId, files) {
  const inputId  = `att-input-${module}-${recordId}`;
  const listId   = `att-list-${module}-${recordId}`;

  const fileRows = files.length
    ? files.map(f => `
        <div class="att-row" id="att-row-${f.attachment_id}"
          style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--slate-100)">
          <span style="font-size:14px">${_attIcon(f.file_type)}</span>
          <span style="flex:1;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${_esc(f.file_name)}">${_esc(f.file_name)}</span>
          ${f.file_size_kb ? `<span style="font-size:11px;color:var(--slate-400)">${f.file_size_kb} KB</span>` : ""}
          <button class="btn btn-xs btn-outline"
            onclick="window.open('${f.file_url}', '_blank')">⬇ Download</button>
          <button class="btn btn-xs btn-red"
            onclick="deleteAttachment(${f.attachment_id}, '${module}', ${recordId}, '${_dpContainerId(module, recordId)}')">
            ✕
          </button>
        </div>
      `).join("")
    : `<div style="color:var(--slate-400);font-size:12px;padding:8px 0">No attachments yet.</div>`;

  container.innerHTML = `
    <div class="dp-section-hd">📎 Attachments</div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <input type="file" id="${inputId}"
        style="flex:1;font-size:12px;padding:5px;border:1.5px solid var(--slate-200);border-radius:6px;background:var(--white)"/>
      <button class="btn btn-outline btn-sm"
        onclick="uploadAttachment('${module}', ${recordId}, '${inputId}', '${_dpContainerId(module, recordId)}')">
        ⬆ Upload
      </button>
    </div>

    <div id="${listId}">${fileRows}</div>
  `;
}

/** Determine the container ID for a given module + record */
function _dpContainerId(module, recordId) {
  const map = {
    m365:          `dp-attachments-m365-${recordId}`,
    globe:         `dp-attachments-globe-${recordId}`,
    subscriptions: `dp-attachments-sub-${recordId}`,
  };
  return map[module] || `dp-attachments-${module}-${recordId}`;
}

/** Upload a file and refresh the panel */
async function uploadAttachment(module, recordId, inputId, containerId) {
  const input = document.getElementById(inputId);
  const file  = input?.files[0];

  if (!file) {
    showToast("Select a file first", "t-error");
    return;
  }

  const MAX_MB = 5;
  if (file.size > MAX_MB * 1024 * 1024) {
    showToast(`File too large (max ${MAX_MB} MB)`, "t-error");
    return;
  }

  // Read as base64 data URL (keeps existing backend contract)
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await fetch(`${API_URL}/api/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          record_id:    recordId,
          file_name:    file.name,
          file_url:     reader.result,
          file_type:    file.type,
          file_size_kb: Math.round(file.size / 1024),
          uploaded_by:  currentUser?.user_id || null,
        }),
      });

      if (!res.ok) throw new Error("Upload failed");

      showToast(`"${file.name}" uploaded`, "t-success");
      input.value = "";

      // Refresh panel in-place
      attachmentPanel(module, recordId, containerId);
    } catch (err) {
      showToast("Upload failed", "t-error");
    }
  };
  reader.readAsDataURL(file);
}

/** Delete an attachment and refresh the panel */
async function deleteAttachment(attachmentId, module, recordId, containerId) {
  try {
    const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");

    showToast("Attachment removed", "t-warning");
    attachmentPanel(module, recordId, containerId);
  } catch (err) {
    showToast("Failed to delete attachment", "t-error");
  }
}

/** File type → emoji icon */
function _attIcon(mimeType) {
  if (!mimeType) return "📄";
  if (mimeType.startsWith("image/"))       return "🖼️";
  if (mimeType === "application/pdf")      return "📕";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("word"))           return "📝";
  return "📄";
}

// ── Wire dpSubscriptions into the DP renderer map ─────────
// Add this to the renderers object in openDP():
//   subscriptions: dpSubscriptions,
