const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : window.location.origin.includes("assetmanagementsystem")
      ? window.location.origin        // frontend & backend same Railway origin
      : "https://assetmanagementsystem-production-51d8.up.railway.app"; // fallback if hosted separately