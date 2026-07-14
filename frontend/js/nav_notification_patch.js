/* ============================================================
   nav_notification_patch.js — Part 1
   ============================================================
   Sidebar Dashboard notification indicator:
     - Collapsed sidebar: icon + persistent red dot.
     - Expanded sidebar: label + red dot + numeric count.

   Disappearance rule (see Dashboard_Notification_System.md):
   per-item acknowledgment, NOT a global "clear on dashboard open."
   A notification clears only when the specific record it refers to
   is opened in its own module (openDP), or acted on directly
   (approve/deny/renew/etc., which removes the underlying condition
   anyway on the next poll).

   Load AFTER nav.js and main.js. Overrides buildSidebar() and
   openDP() from main.js — see header comment in each override for
   why that's safe (both are called by bare name, never by a
   captured reference).

   Requires the CSS additions in Dashboard_Notification_System.md
   and #nav-dashboard to remain the dashboard nav item's id (set by
   nav.js, unchanged).
   ============================================================ */

const NOTIFICATION_MODULES = ['contracts', 'vehicle', 'insurance', 'm365', 'globe', 'subscriptions'];

/* ── Sidebar build — adds the dot + count markup to Dashboard only ── */
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
      // ✅ NEW: persistent dot (visible collapsed or expanded) + count
      // badge (fades in with the label, same as other nav badges).
      div.innerHTML = `
        <span class="nav-icon-wrap">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-notif-dot" id="nb-dash-dot" style="display:none"></span>
        </span>
        <span class="nav-label">${item.label}</span>
        <span class="nav-notif-count" id="nb-dash-count" style="display:none">0</span>
        ${extras}`;
    } else {
      div.innerHTML = `<span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span>${extras}`;
    }

    nav.appendChild(div);
  });

  refreshNotifications();
}

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

/* ── openDP override: clears the notification for whatever record was
   just opened. Safe to redeclare — every call site invokes openDP(...)
   by bare name, never a captured reference (unlike DP_RENDERERS). ──── */
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

  // ✅ NEW (Part 1): viewing the record acknowledges its notification(s).
  markNotificationSeen(type, id);
}

// Poll every 60s while the tab is visible — same pattern as the existing
// dashboard/contract-request pollers in main.js.
setInterval(() => {
  if (document.hidden) return;
  refreshNotifications();
}, 60 * 1000);
