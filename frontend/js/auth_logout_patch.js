/* ============================================================
   auth_logout_patch.js — Logout_Log_Fix.md
   ============================================================
   Hardens logout logging with a fetch+keepalive fallback
   alongside navigator.sendBeacon(). sendBeacon() returns `true`
   even when the request is silently dropped downstream (some
   corporate proxies/extensions strip Blob-typed beacons with no
   error surfaced to the page) — this fallback guarantees the log
   attempt is retried through a normal keepalive fetch when the
   beacon call itself throws or is unsupported.

   Load AFTER auth.js.

   NOTE on load order: doLogout() is called via onclick="doLogout()"
   in index.html, which resolves the function BY NAME at click time
   — so this override takes full effect for the Sign Out button.
   The beforeunload/pagehide listeners in auth.js were registered
   with a captured reference to the OLD _logTabClose, so redefining
   the function name alone would NOT affect them (same gotcha as
   DP_RENDERERS.laptop). This file explicitly re-registers those
   two listeners at the bottom so the fallback also applies there.
   ============================================================ */

// frontend/js/auth_logout_patch.js — replace these two functions
function _sendLogoutLog(description) {
  if (!currentUser) return Promise.resolve();

  const payload = JSON.stringify({
    user_id: currentUser.user_id,
    action_type: "LOGOUT",
    module: "USER",
    description,
    reference_type: "MANUAL",       // ✅ was currentUser.user_id (numeric) — now a consistent string
    performed_by: currentUser.name,
  });

  // ✅ Fire BOTH unconditionally instead of beacon-then-fallback-on-failure.
  // sendBeacon returning true doesn't guarantee delivery, so we no longer
  // gate the fetch fallback behind it.
  try {
    navigator.sendBeacon(`${API_URL}/api/logs`, new Blob([payload], { type: "application/json" }));
  } catch (e) { /* ignore */ }

  return fetch(`${API_URL}/api/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function doLogout() {
  _loggingOut = true;
  _tabCloseLogged = true;
  const logPromise = _sendLogoutLog(`User ${currentUser?.name} logged out`);
  sessionStorage.removeItem("user");
  // ✅ give the network layer a beat to actually dispatch before reload
  Promise.race([logPromise, new Promise(r => setTimeout(r, 250))])
    .finally(() => location.reload());
}

function _logTabClose() {
  if (!currentUser || _loggingOut || _tabCloseLogged) return;
  _tabCloseLogged = true;
  _sendLogoutLog(`User ${currentUser.name} closed the tab / session ended`);
}

// ✅ Re-register so the beforeunload/pagehide paths also get the
// fetch+keepalive fallback (the original listeners in auth.js still
// fire too, pointing at the old sendBeacon-only version — harmless,
// since _tabCloseLogged guards against a duplicate log entry either
// way, whichever fires first wins).
window.addEventListener("beforeunload", _logTabClose);
window.addEventListener("pagehide", _logTabClose);
