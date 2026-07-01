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

function doLogout() {
  if (currentUser) {
    addLog("LOGOUT", "USER", `User ${currentUser.name} logged out`, currentUser.user_id); // Part 5
  }
  sessionStorage.removeItem("user");   // was localStorage
  location.reload();
}

function updateUserUI() {
  if (!currentUser) return;

  // Sidebar
  document.getElementById("sb-avatar").textContent = currentUser.initials;
  document.getElementById("sb-uname").textContent = currentUser.name;
  document.getElementById("sb-role-tag").textContent = currentUser.role;

  // Topbar
  document.getElementById("tb-avatar").textContent = currentUser.initials;
  document.getElementById("tb-uname").textContent = currentUser.name;
  document.getElementById("tb-urole").textContent = currentUser.role;

  const rolePill = document.getElementById("tb-role-pill");
  rolePill.textContent = currentUser.role;

  // Reset classes to avoid "admin stuck"
  rolePill.className = "tb-role-pill " + currentUser.role;
}