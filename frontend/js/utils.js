function todayStr() { return new Date().toISOString().slice(0,10); }
function clearForm(ids) { ids.forEach(id => { const el=document.getElementById(id); if(el) el.value=''; }); }

function showToast(msg, type='t-success') {
  const icons = { 't-success':'✅','t-error':'❌','t-warning':'⚠️','t-info':'ℹ️' };
  const wrap = document.getElementById('toast-wrap');
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'all .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// Helpers for DP content
function dpField(label, value, cls='') {
  const valHTML = value
    ? `<div class="dp-value ${cls}">${value}</div>`
    : `<div class="dp-value muted">—</div>`;
  return `<div class="dp-field"><div class="dp-label">${label}</div>${valHTML}</div>`;
}
function dpFieldFull(label, value, cls='') {
  const valHTML = value
    ? `<div class="dp-value ${cls}">${value}</div>`
    : `<div class="dp-value muted">—</div>`;
  return `<div class="dp-field full"><div class="dp-label">${label}</div>${valHTML}</div>`;
}
function dpSection(title, icon='') {
  return `<div class="dp-section-hd">${icon ? icon+' ' : ''}${title}</div>`;
}
function badge(text, cls) { return `<span class="badge ${cls}">${text}</span>`; }


/* ──────────────────────────────────────────────────────────────
   MODAL HELPERS
────────────────────────────────────────────────────────────── */
function openM(id)  { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);

  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "🙈";
  } else {
    input.type = "password";
    icon.textContent = "👁️";
  }
}


const LIMITS = {
  NAME: 50,
  EMAIL: 50,
  PASSWORD: 50,
  REMARKS: 255
};
