let currentUser = null;

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
  .then(res => {
    if (!res.ok) throw new Error("Invalid login");
    return res.json();
  })
  .then(user => {
    currentUser = user;
    console.log("USER:", currentUser);

    try {
      initApp();
    } catch (e) {
      console.error("INIT ERROR:", e);
    }

    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";
  });
}

function doLogout() {
  localStorage.removeItem("user");
  location.reload();
}