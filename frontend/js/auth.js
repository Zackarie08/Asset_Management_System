function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  fetch("http://localhost:3000/api/auth/login", {
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
``


function doLogin() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  fetch("http://localhost:3000/api/auth/login", {
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
    localStorage.setItem("user", JSON.stringify(data.user));

    // ✅ Set current user (for your UI system)
    currentUser = {
      name: data.user.name,
      role: data.user.role,
      initials: data.user.name.substring(0,2).toUpperCase()
    };

    // ✅ Hide login
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');

    // ✅ Load UI
    buildSidebar();
    initAllModules();
  })
  .catch(err => {
    console.error(err);
    document.getElementById("login-error").innerText = "Server error";
  });
}

function doLogout() {
  localStorage.removeItem("user");
  location.reload();
}
``

window.onload = function() {
  const savedUser = localStorage.getItem("user");

  if (savedUser) {
    const user = JSON.parse(savedUser);

    currentUser = {
      name: user.name,
      role: user.role,
      initials: user.name.substring(0,2).toUpperCase()
    };

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');

    buildSidebar();
    initAllModules();
  }
};