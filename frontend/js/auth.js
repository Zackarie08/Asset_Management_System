function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.user) {
      // ✅ Save user (simulate session)
      localStorage.setItem("user", JSON.stringify(data.user));

      // ✅ Redirect based on role
      if (data.user.role === "admin") {
        window.location.href = "pages/dashboard.html";
      } else {
        window.location.href = "pages/dashboard.html";
      }

    } else {
      document.getElementById("error").innerText = "Login failed";
    }
  });
}


function doLogin() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  })
  .then(res => res.json())
  .then(data => {

    if (!data.user) {
      document.getElementById("login-error").innerText = "Invalid email or password";
      return;
    }

    // ✅ Save user
    sessionStorage.setItem("user", JSON.stringify(data.user));   // was localStorage

    // ✅ Set current user (for your UI system)
    currentUser = {
      user_id: data.user.user_id,
      name: data.user.name,
      role: data.user.role,
      email: data.user.email,
      initials: data.user.name.substring(0,2).toUpperCase()
    };
    addLog("LOGIN", "USER", `User ${currentUser.name} logged in`, currentUser.user_id); // Part 5


    // ✅ Hide login
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');

    // ✅ Load UI
    buildSidebar();
    initAllModules();
    updateUserUI();
  })
  .catch(err => {
    console.error(err);
    document.getElementById("login-error").innerText = "Server error";
  });
}

let _loggingOut = false;
let _tabCloseLogged = false;

function doLogout() {
  if (currentUser) {
    addLog("LOGOUT", "USER", `User ${currentUser.name} logged out`, currentUser.user_id);
  }
  _loggingOut = true; // prevents the beforeunload handler from double-logging
  sessionStorage.removeItem("user");
  location.reload();
}

// ✅ NEW: logs LOGOUT when the tab is closed or the session ends
// without the user clicking "Sign Out" (e.g. closing the X, refreshing
// away, or browser/device shutdown). Uses sendBeacon because regular
// fetch() calls are frequently cancelled mid-flight during unload.
function _logTabClose() {
  if (!currentUser || _loggingOut || _tabCloseLogged) return;
  _tabCloseLogged = true;

  const payload = JSON.stringify({
    user_id: currentUser.user_id,
    action_type: "LOGOUT",
    module: "USER",
    description: `User ${currentUser.name} closed the tab / session ended`,
    reference_type: currentUser.user_id
  });

  navigator.sendBeacon(
    `${API_URL}/api/logs`,
    new Blob([payload], { type: "application/json" })
  );
}

window.addEventListener("beforeunload", _logTabClose);
window.addEventListener("pagehide", _logTabClose); // fallback for mobile Safari

/* ────────────────────────────────────────────────────────────
   TOPBAR USER MENU
   ✅ NEW (Sidebar/Topbar Redesign): user identity + account
   actions now live entirely in the topbar dropdown instead of
   the sidebar. See Topbar_UI_Improvement_Report.md.
──────────────────────────────────────────────────────────── */
function toggleUserMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('tb-user-menu');
  if (!menu) return;
  menu.classList.toggle('open');
}

function closeUserMenu() {
  const menu = document.getElementById('tb-user-menu');
  if (menu) menu.classList.remove('open');
}

// Close the dropdown on any outside click, and on Escape.
document.addEventListener('click', (e) => {
  const menu = document.getElementById('tb-user-menu');
  if (!menu || !menu.classList.contains('open')) return;
  if (!menu.contains(e.target)) closeUserMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeUserMenu();
});

function updateUserUI() {
  if (!currentUser) return;

  const roleLabelMap = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    employee: 'Employee',
    intern: 'Intern',
  };
  const roleLabel = roleLabelMap[currentUser.role] || currentUser.role;

  // Topbar trigger (avatar + name + role, collapsed summary)
  _setTxtSafe("tb-avatar", currentUser.initials);
  _setTxtSafe("tb-uname", currentUser.name);
  _setTxtSafe("tb-urole", roleLabel);

  // Topbar dropdown panel (expanded identity + actions)
  _setTxtSafe("tb-dropdown-name", currentUser.name);
  _setTxtSafe("tb-dropdown-email", currentUser.email || '—');

  const pill = document.getElementById("tb-dropdown-rolepill");
  if (pill) {
    pill.textContent = roleLabel;
    pill.className = "tb-dropdown-rolepill " + currentUser.role;
  }
}

function _setTxtSafe(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}