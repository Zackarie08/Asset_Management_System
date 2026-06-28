// ============================================================
// users.js — User management with search, filter, pagination
// ============================================================

let userEditId     = null;
let resetUserEmail = "";
let selectedUserId = null;

// Filter + pagination state
let userSearchQuery  = '';
let userFilterDept   = 'all';
let userFilterRole   = 'all';
let currentUserPage  = 1;
const usersPerPage   = 20;

// Cache full user list for client-side filtering
let _allUsers = [];

/* ── APPLY FILTERS ──────────────────────────────────────── */
function applyUserFilters() {
  userFilterDept  = document.getElementById('user-filter-dept').value;
  userFilterRole  = document.getElementById('user-filter-role').value;
  currentUserPage = 1;
  _renderUserTable();
}

/* ── FILTER LOGIC ───────────────────────────────────────── */
function _filterUsers(users) {
  return users.filter(u => {

    // Search — name or email
    if (userSearchQuery) {
      const haystack = `${u.name} ${u.email}`.toLowerCase();
      if (!haystack.includes(userSearchQuery)) return false;
    }

    // Department filter
    if (userFilterDept !== 'all' && u.department !== userFilterDept) return false;

    // Role filter
    if (userFilterRole !== 'all' && u.role !== userFilterRole) return false;

    return true;
  });
}

/* ── PAGINATION ─────────────────────────────────────────── */
function _renderUserPagination(total) {
  const container = document.getElementById('user-pagination-container');
  if (!container) return;

  const totalPages = Math.ceil(total / usersPerPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentUserPage === 1;
  prev.onclick = () => { currentUserPage--; _renderUserTable(); };
  wrap.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentUserPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => { currentUserPage = i; _renderUserTable(); };
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentUserPage === totalPages;
  next.onclick = () => { currentUserPage++; _renderUserTable(); };
  wrap.appendChild(next);

  container.appendChild(wrap);
}

/* ── RENDER TABLE (client-side filter + paginate) ───────── */
function _renderUserTable() {
  const filtered  = _filterUsers(_allUsers);
  const total     = filtered.length;
  const start     = (currentUserPage - 1) * usersPerPage;
  const paginated = filtered.slice(start, start + usersPerPage);

  const tbody = document.getElementById('user-tbody');
  tbody.innerHTML = '';

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--slate-400)">No users found.</td></tr>`;
  } else {
    paginated.forEach(u => {
      const roleCls = {
        super_admin: 'b-red',
        admin:       'b-amber',
        employee:    'b-green',
        intern:      'b-blue',
      }[u.role] || 'b-slate';

      const tr = document.createElement('tr');
      tr.className = 'tr-clickable';
      tr.innerHTML = `
        <td class="td-mono">${u.user_id}</td>
        <td class="td-strong">${u.name}</td>
        <td class="td-muted">${u.email}</td>
        <td>${u.department || '—'}</td>
        <td><span class="badge ${roleCls}">${u.role}</span></td>
      `;
      tr.addEventListener('click', () => openDP('user', u.user_id, tr));
      tbody.appendChild(tr);
    });
  }

  document.getElementById('user-ct').textContent = `${total} users`;
  _renderUserPagination(total);
}

/* ── FETCH + RENDER ─────────────────────────────────────── */
async function renderUsers() {
  try {
    const res  = await fetch(`${API_URL}/api/auth/users`);
    _allUsers  = await res.json();
    currentUserPage = 1;
    _renderUserTable();
  } catch (err) {
    console.error('renderUsers error:', err);
    showToast('Failed to load users', 't-error');
  }
}

/* ── SAVE USER (create OR edit) ─────────────────────────── */
function saveUser() {
  const name       = document.getElementById('u-name').value.trim();
  const email      = document.getElementById('u-email').value.trim();
  const password   = document.getElementById('u-password').value;
  const role       = document.getElementById('u-role').value;
  const department = document.getElementById('u-dept').value;

  if (!name || !email || !department) {
    showToast('Please fill all required fields', 't-error');
    return;
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) { showToast('Invalid email format', 't-error'); return; }
  if (name.length < 2) { showToast('Name too short', 't-error'); return; }

  if (!userEditId) {
    if (!password || password.length < 6) {
      showToast('Password must be at least 6 characters', 't-error');
      return;
    }
    fetch(`${API_URL}/api/auth/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, department })
    })
    .then(res => { if (!res.ok) throw new Error('Failed'); showToast('User added', 't-success'); addLog('CREATE', 'USER', `Added user: ${name} (${email})`, email); closeM('m-add-user'); renderUsers(); })
    .catch(() => showToast('Error adding user', 't-error'));
  } else {
    fetch(`${API_URL}/api/auth/users/${userEditId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role, department })
    })
    .then(res => { if (!res.ok) throw new Error('Failed'); showToast('User updated', 't-success'); addLog('UPDATE', 'USER', `Updated user: ${name} (${email})`, email); userEditId = null; closeM('m-add-user'); renderUsers(); if (dpOpen && dpCurrentType === 'user') dpUser(dpCurrentId); })
    .catch(() => showToast('Error updating user', 't-error'));
  }
}

/* ── EDIT USER ──────────────────────────────────────────── */
function editUser(id) {
  fetch(`${API_URL}/api/auth/users`)
    .then(res => res.json())
    .then(data => {
      const u = data.find(x => x.user_id === id);
      if (!u) return;
      userEditId = id;
      document.getElementById('u-name').value     = u.name;
      document.getElementById('u-email').value    = u.email;
      document.getElementById('u-dept').value     = u.department || '';
      document.getElementById('u-role').value     = u.role;
      document.getElementById('u-password').value = '';
      const roleInput = document.getElementById('u-role');
      roleInput.setAttribute('data-original', u.role);
      roleInput.disabled = u.role === 'super_admin';
      openM('m-add-user');
    });
}

/* ── DELETE USER ────────────────────────────────────────── */
let deleteUserId    = null;
let deleteUserName  = '';
let deleteUserEmail = '';

function deleteUser(id, name, email, role) {
  if (role === 'super_admin') { showToast('Cannot delete super admin', 't-error'); return; }
  deleteUserId    = id;
  deleteUserName  = name;
  deleteUserEmail = email;
  openM('m-confirm-user-del');
}

function confirmDeleteUser() {
  fetch(`${API_URL}/api/auth/users/${deleteUserId}`, { method: 'DELETE' })
    .then(res => { if (!res.ok) throw new Error('Failed'); showToast('User deleted', 't-warning'); addLog('DELETE', 'USER', `Deleted user: ${deleteUserName} (${deleteUserEmail})`, deleteUserEmail); closeM('m-confirm-user-del'); closeDP(); renderUsers(); })
    .catch(() => showToast('Error deleting user', 't-error'));
}

/* ── RESET PASSWORD ─────────────────────────────────────── */
function resetPassword(id, name, email) {
  selectedUserId = id;
  resetUserEmail = email;
  document.getElementById('rp-user-name').textContent = name;
  document.getElementById('rp-pass').value  = '';
  document.getElementById('rp-pass2').value = '';
  openM('m-reset-pass');
}

function confirmResetPassword() {
  const pass1 = document.getElementById('rp-pass').value;
  const pass2 = document.getElementById('rp-pass2').value;
  if (!pass1 || !pass2)  { showToast('Fill all fields', 't-error'); return; }
  if (pass1 !== pass2)   { showToast('Passwords do not match', 't-error'); return; }
  if (pass1.length < 6)  { showToast('Password too short', 't-error'); return; }
  fetch(`${API_URL}/api/auth/users/reset-password/${selectedUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: pass1 })
  })
  .then(() => { showToast('Password reset', 't-success'); addLog('UPDATE', 'USER', `Password reset for ${resetUserEmail}`, resetUserEmail); closeM('m-reset-pass'); })
  .catch(() => showToast('Error resetting password', 't-error'));
}