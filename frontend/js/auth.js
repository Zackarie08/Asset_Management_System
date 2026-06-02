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
  .then(res => res.json())
  .then(user => {
    if (!user.user_id) {
      showToast("Invalid login", "t-error");
      return;
    }

    currentUser = user;
    console.log("USER:", currentUser);

    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";

    initApp();
  })
  .catch(err => {
    console.error(err);
    showToast("Login error", "t-error");
  });
}

function doLogout() {
  localStorage.removeItem("user");
  location.reload();
}