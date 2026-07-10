// frontend/js/user_session_patch.js
function autoLogin() {
  const savedUser = sessionStorage.getItem("user");
  if (!savedUser) return;

  const user = JSON.parse(savedUser);

  currentUser = {
    user_id: user.user_id,
    name: user.name,
    role: user.role,
    email: user.email,             // ✅ FIX: was missing
    department: user.department,   // ✅ also preserve for consistency
    initials: user.name.substring(0, 2).toUpperCase()
  };

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');

  buildSidebar();
  initAllModules();

  const savedPage = sessionStorage.getItem("currentPage");
  if (savedPage) navigate(savedPage);

  if (typeof updateUserUI === "function") updateUserUI();
}