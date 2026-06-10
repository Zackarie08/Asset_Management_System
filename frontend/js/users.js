let resetUserEmail = "";
let userEditId = null;

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
        <button class="btn btn-outline btn-xs"
            onclick="resetPassword(${u.user_id}, '${u.name}', '${u.email}')">
            Reset Password
        </button>
        <button class="btn btn-outline btn-xs"
          onclick="editUser(${u.user_id})">
            Edit User
        </button>

        ${u.role !== "super_admin"
          ? `<button class="btn btn-red btn-xs"
                onclick="deleteUser(${u.user_id}, '${u.name}', '${u.email}', '${u.role}')">
                Delete User
            </button>`
          : `<span class="btn btn-muted btn-xs">Protected</span>`
        }
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

  if (!name || !email || !role || !department) {
    showToast("Please fill all required fields", "t-error");
    return;
  }

  // ✅ password only required if ADD mode
  if (!userEditId && (!password || password.length < 6)) {
    showToast("Password must be at least 6 characters", "t-error");
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    showToast("Invalid email format", "t-error");
    return;
  }

  if (name.length < 2) {
    showToast("Name too short", "t-error");
    return;
  }

  if (password.length < 6) {
    showToast("Password too short", "t-error");
    return;
  }

  if (userEditId) {
    // ✅ EDIT MODE
    fetch(`${API_URL}/api/auth/users/${userEditId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        role,
        department
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Update failed");

      showToast("User updated", "t-success");

      addLog(
        "UPDATE",
        "USER",
        `Updated user: ${name} (${email})`,
        email
      );

      userEditId = null;
      closeM("m-add-user");
      renderUsers();
    })
    .catch(err => {
      console.error(err);
      showToast("Error updating user", "t-error");
    });

  } else {
    // ✅ ADD MODE (your current code)
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
    .then(res => {
      if (!res.ok) throw new Error("Failed");

      showToast("User added", "t-success");

      addLog(
        "CREATE",
        "USER",
        `Added user: ${name} (${email})`,
        email
      );

      closeM("m-add-user");
      renderUsers();
    })
    .catch(err => {
      console.error(err);
      showToast("Error adding user", "t-error");
    });
  }
}

let deleteUserId = null;
let deleteUserName = "";
let deleteUserEmail = "";

function deleteUser(id, name, email, role) {
  if (role === "super_admin") {
    showToast("Cannot delete super admin", "t-error");
    return;
  }

  deleteUserId = id;
  deleteUserName = name;
  deleteUserEmail = email;

  openM("m-confirm-user-del");
}


let selectedUserId = null;

function resetPassword(id, name, email) {
  selectedUserId = id;
  resetUserEmail = email;

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

  if (pass1.length < 6) {
    showToast("Password too short", "t-error");
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
    showToast("Password reset", "t-success");
    addLog(
      "UPDATE",
      "USER",
      `Password reset for ${resetUserEmail}`,
      resetUserEmail
    );
    closeM("m-reset-pass");
  })
}


function confirmDeleteUser() {
  fetch(`${API_URL}/api/auth/users/${deleteUserId}`, {
    method: "DELETE"
  })
  .then(res => {
    if (!res.ok) throw new Error("Delete failed");

    showToast("User deleted", "t-warning");

    addLog(
      "DELETE",
      "USER",
      `Deleted user: ${deleteUserName} (${deleteUserEmail})`,
      deleteUserEmail
    );

    closeM("m-confirm-user-del");
    renderUsers();
  })
  .catch(err => {
    console.error(err);
    showToast("Error deleting user", "t-error");
  });
}

function editUser(id) {
  fetch(`${API_URL}/api/auth/users`)
    .then(res => res.json())
    .then(data => {
      const u = data.find(x => x.user_id === id);
      if (!u) return;

      editUserId = id;

      document.getElementById("e-name").value = u.name;
      document.getElementById("e-email").value = u.email;
      document.getElementById("e-dept").value = u.department || "";
      document.getElementById("e-role").value = u.role;

      // ✅ 🔥 SUPER ADMIN PROTECTION
      if (u.role === "super_admin") {
        document.getElementById("e-role").disabled = true;

        showToast("Super admin role cannot be changed", "t-warning");
      } else {
        document.getElementById("e-role").disabled = false;
      }

      openM("m-edit-user");
    });
}

function updateUser() {
  const name = document.getElementById("e-name").value;
  const email = document.getElementById("e-email").value;
  const department = document.getElementById("e-dept").value;
  const role = document.getElementById("e-role").value;

  if (!name || !email || !department || !role) {
    showToast("Fill all required fields ❌", "t-error");
    return;
  }

  fetch(`${API_URL}/api/auth/users/${editUserId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      email,
      department,
      role
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("Update failed");

    showToast("User updated", "t-success");

    addLog(
      "UPDATE",
      "USER",
      `Updated user: ${name} (${email})`,
      email
    );

    closeM("m-edit-user");
    renderUsers();
  })
  .catch(err => {
    console.error(err);
    showToast("Error updating user", "t-error");
  });
}