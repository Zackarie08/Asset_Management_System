function todayStr() { return new Date().toISOString().slice(0,10); }

// ✅ NEW: shared human-readable date formatter used across the Dashboard,
// Contracts, Insurance, Subscriptions, and Vehicles modules.
// "2026-09-06T00:00:00.000Z" → "September 6, 2026"
function formatDateHuman(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

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
function openM(id)  { 
  document.getElementById(id).classList.add('open'); 
}

function closeM(id) {
  const el = document.getElementById(id);
  el.classList.remove("open");

  // ✅ auto reset form inside modal
  resetForm(id);
}

function resetForm(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const inputs = container.querySelectorAll("input, textarea, select");

  inputs.forEach(el => {
    if (el.tagName === "SELECT") {
      el.selectedIndex = 0;
    } else {
      el.value = "";
    }
  });
}

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) {
      e.stopPropagation();
    }
  });
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

const selectState = {}; 

function makeSearchable(inputId, listId, items) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  if (!input || !list) return; 

  selectState[inputId] = false;

  input.addEventListener("input", () => {
    selectState[inputId] = false;

    const val = input.value.toLowerCase();
    list.innerHTML = "";

    const filtered = items.filter(i =>
      i.toLowerCase().includes(val)
    );

    filtered.forEach(name => {
      const div = document.createElement("div");
      div.textContent = name;
      div.className = "select-item";

      div.onclick = () => {
        input.value = name;
        list.innerHTML = "";
        selectState[inputId] = true;
      };

      list.appendChild(div);
    });
  });

  // ✅ prevent Enter submit
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   SHARED PAGINATION CONTROL
   ──────────────────────────────────────────────────────────────
   Sliding-window pagination, no ellipsis. Shows up to 10 page
   numbers at once. Window stays fixed at 1-10 while the current
   page is within the first 6; once current page reaches 7+, the
   window slides so the current page always sits as the 6th number
   shown, clamped so it never goes past page 1 or the last page.

   Named renderPaginationControls (not renderPagination) to avoid
   colliding with inventory.js's existing global renderPagination().

   @param containerId  - id of the element to render controls into
   @param total         - total number of filtered items
   @param perPage       - items per page
   @param currentPage   - the currently active page (1-indexed)
   @param onPageChange  - callback(newPage) fired when a page/prev/next is clicked
───────────────────────────────────────────────────────────────── */
function renderPaginationControls(containerId, total, perPage, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(total / perPage);
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const WINDOW_SIZE = 10;
  let start, end;

  if (totalPages <= WINDOW_SIZE) {
    start = 1;
    end = totalPages;
  } else {
    // current page sits at the 6th slot once sliding begins, clamped at both ends
    start = Math.min(Math.max(currentPage - 5, 1), totalPages - WINDOW_SIZE + 1);
    end = start + WINDOW_SIZE - 1;
  }

  const wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  const prev = document.createElement('button');
  prev.className = 'btn btn-xs btn-outline pg-btn';
  prev.textContent = '← Prev';
  prev.disabled = currentPage === 1;
  prev.onclick = () => onPageChange(currentPage - 1);
  wrap.appendChild(prev);

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-xs pg-btn ' + (i === currentPage ? 'btn-primary' : 'btn-outline');
    btn.textContent = i;
    btn.onclick = () => onPageChange(i);
    wrap.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'btn btn-xs btn-outline pg-btn';
  next.textContent = 'Next →';
  next.disabled = currentPage === totalPages;
  next.onclick = () => onPageChange(currentPage + 1);
  wrap.appendChild(next);

  container.appendChild(wrap);
}