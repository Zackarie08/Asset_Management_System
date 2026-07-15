/* ============================================================
   users_history_patch.js — Main History for Users module
   ============================================================
   Adds "View Item History" to the User DP and sends
   performer_id/performed_by on create/edit/delete/reset-password
   so backend attribution (already added in auth.js) isn't null.

   Load AFTER users.js, main.js, and item_history_panel.js.
   ============================================================ */

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
      body: JSON.stringify({ name, email, password, role, department, performer_id: currentUser.user_id, performed_by: currentUser.name })
    })
    .then(res => { if (!res.ok) throw new Error('Failed'); showToast('User added', 't-success'); addLog('CREATE', 'USER', `Added user: ${name} (${email})`, email); closeM('m-add-user'); renderUsers(); })
    .catch(() => showToast('Error adding user', 't-error'));
  } else {
    fetch(`${API_URL}/api/auth/users/${userEditId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role, department, performer_id: currentUser.user_id, performed_by: currentUser.name })
    })
    .then(res => { if (!res.ok) throw new Error('Failed'); showToast('User updated', 't-success'); addLog('UPDATE', 'USER', `Updated user: ${name} (${email})`, email); userEditId = null; closeM('m-add-user'); renderUsers(); if (dpOpen && dpCurrentType === 'user') dpUser(dpCurrentId); })
    .catch(() => showToast('Error updating user', 't-error'));
  }
}

function confirmDeleteUser() {
  fetch(`${API_URL}/api/auth/users/${deleteUserId}?performer_id=${currentUser.user_id}&performed_by=${encodeURIComponent(currentUser.name)}`, { method: 'DELETE' })
    .then(res => { if (!res.ok) throw new Error('Failed'); showToast('User deleted', 't-warning'); addLog('DELETE', 'USER', `Deleted user: ${deleteUserName} (${deleteUserEmail})`, deleteUserEmail); closeM('m-confirm-user-del'); closeDP(); renderUsers(); })
    .catch(() => showToast('Error deleting user', 't-error'));
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
    body: JSON.stringify({ new_password: pass1, performer_id: currentUser.user_id, performed_by: currentUser.name })
  })
  .then(() => { showToast('Password reset', 't-success'); addLog('UPDATE', 'USER', `Password reset for ${resetUserEmail}`, resetUserEmail); closeM('m-reset-pass'); })
  .catch(() => showToast('Error resetting password', 't-error'));
}

function dpUser(id) {
  const u = _allUsers.find(x => x.user_id === id);
  if (!u) return;

  const roleCls = {
    super_admin: 'b-red',
    admin:       'b-amber',
    employee:    'b-green',
    intern:      'b-blue',
  }[u.role] || 'b-slate';

  setDPHeader('👤', '#eff6ff', u.name, u.role);

  const isSuper     = u.role === 'super_admin';
  const canModify   = isAdminUser() && !isSuper;

  document.getElementById('dp-body').innerHTML = `
    <div class="dp-section">
      <div class="dp-section-hd">👤 User Details</div>
      <div class="dp-grid">
        ${dpField('Name',       u.name)}
        ${dpField('Email',      u.email)}
        ${dpField('Department', u.department || '—')}
        ${dpField('Role',       `<span class="badge ${roleCls}">${u.role}</span>`)}
      </div>
    </div>

    <div class="dp-section">
      <div class="dp-section-hd">⚡ Actions</div>
      <div class="dp-action-row">
        ${isAdminUser() && canModify ? `<button class="btn btn-primary btn-sm" onclick="editUser(${u.user_id})">✏️ Edit</button>` : ''}
        ${isAdminUser() ? `<button class="btn btn-outline btn-sm" onclick="resetPassword(${u.user_id}, '${u.name}', '${u.email}')">🔑 Reset Password</button>` : ''}
        ${itemHistoryButton('users', u.user_id, u.name)}
        ${isAdminUser() && canModify ? `<button class="btn btn-red btn-sm" onclick="deleteUser(${u.user_id}, '${u.name}', '${u.email}', '${u.role}')">🗑️ Delete</button>` : ''}
        ${isAdminUser() && !canModify ? `<span class="td-muted" style="margin-left:6px">Edit/Delete disabled for Super Admin</span>` : ''}
      </div>
    </div>
  `;

  document.getElementById('dp-footer').style.display = 'none';
}

if (typeof DP_RENDERERS !== 'undefined') DP_RENDERERS.user = dpUser;
