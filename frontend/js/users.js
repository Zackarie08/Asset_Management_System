async function renderUsers() {
  const res = await fetch(`${API_URL}/api/auth/users`);
  const data = await res.json();

  const tbody = document.getElementById("user-tbody");
  tbody.innerHTML = "";

  data.forEach(u => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.user_id}</td>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${u.department || '-'}</td>
      <td>${u.role}</td>
      <td>
        <td>
        <button class="btn btn-outline btn-xs"
            onclick="resetPassword(${u.user_id}, '${u.name}')">
            Reset Password
        </button>

        <button class="btn btn-red btn-xs"
            onclick="deleteUser(${u.user_id})">
            Delete User
        </button>
        </td>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function saveUser() {
  const name = document.getElementById("u-name").value;
  const email = document.getElementById("u-email").value;
  const password = document.getElementById("u-password").value;
  const role = document.getElementById("u-role").value;
  const department = document.getElementById("u-dept").value;

  fetch(`${API_URL}/api/auth/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      email,
      password,
      role,
      department
    })
  })
  .then(() => {
    renderUsers();
    closeM("m-add-user");
  });
}

function deleteUser(id) {
  if (!confirm("Delete this user?")) return;

  fetch(`${API_URL}/api/auth/users/${id}`, {
    method: "DELETE"
  })
  .then(() => {
    renderUsers();
  });
}

let selectedUserId = null;

function resetPassword(id, name) {
  selectedUserId = id;

  document.getElementById("rp-user-name").textContent = name;
  document.getElementById("rp-pass").value = "";
  document.getElementById("rp-pass2").value = "";

  openM("m-reset-pass");
}

function confirmResetPassword() {
  const pass1 = document.getElementById("rp-pass").value;
  const pass2 = document.getElementById("rp-pass2").value;

  if (!pass1 || !pass2) {
    showToast("Fill all fields", "t-error");
    return;
  }

  if (pass1 !== pass2) {
    showToast("Passwords do not match", "t-error");
    return;
  }

  fetch(`${API_URL}/api/auth/users/reset-password/${selectedUserId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      new_password: pass1
    })
  })
  .then(() => {
    showToast("Password reset ✅", "t-success");
    closeM("m-reset-pass");
  });
}