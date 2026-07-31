// backend/utils/roleCheck.js
// Shared server-side role check — Delete is Super Admin ONLY across every
// module now (Admin retains Create/Edit, but not Delete). Frontend button
// visibility is UX only; this is the real enforcement, per the project's
// "server-side authority is canonical" principle. Every DELETE route now
// requires ?user_id=<id> in the query string and rejects with 403 unless
// that user's role is exactly 'super_admin'.

const pool = require("../db");

async function isSuperAdmin(userId) {
  if (!userId) return false;
  const result = await pool.query("SELECT role FROM users WHERE user_id=$1", [userId]);
  return result.rows[0]?.role === "super_admin";
}

module.exports = { isSuperAdmin };