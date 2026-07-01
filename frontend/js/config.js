// API_URL is not sensitive (it's called from the browser, so it's always
// visible). This just avoids hardcoding one deployment's URL so the file
// doesn't need to change per environment.
const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : window.location.origin.includes("assetmanagementsystem")
      ? window.location.origin        // frontend & backend same Railway origin
      : "https://assetmanagementsystem-production-51d8.up.railway.app"; // fallback if hosted separately