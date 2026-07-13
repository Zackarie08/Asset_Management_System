// config.js
//
// FIX LOG (this revision):
//   • API_URL is now "" (relative) instead of an environment-sniffed
//     absolute URL. Since server.js now serves this frontend from the
//     SAME Express app as the API (single Railway origin), every
//     fetch(`${API_URL}/api/...`) call in the codebase automatically
//     resolves to the correct host — locally, on Railway, or on any
//     future domain — with zero per-file changes needed.
//
// If you ever split the frontend and backend into two separate
// deployments again, restore an absolute URL here.
const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : window.location.origin.includes("assetmanagementsystem")
      ? window.location.origin        // frontend & backend same Railway origin
      : "https://assetmanagementsystem.up.railway.app"; // fallback if hosted separately