// backend/utils/itemHistory.js
// Global Item History writer — Part 8.
//
// Call this from any route file, the same way logAction() (system_log) is
// already called. This is intentionally a SEPARATE function/table from
// logAction — system_log is the system-wide admin audit trail; item_history
// is a single record's own timeline, shown via "View Item History" in that
// record's detail panel.
//
// Usage:
//   const { logItemHistory } = require("../utils/itemHistory");
//   await logItemHistory({
//     module: "inventory",
//     record_id: item.inventory_gen_id,
//     action: "EDITED",
//     field_name: "current_quantity",
//     old_value: oldQty,
//     new_value: newQty,
//     remarks: "Manual stock correction",
//     performed_by_id: user_id,
//     performed_by_name: performed_by,
//   });

const pool = require("../db");

// Whitelist mirrors attachments.js's ALLOWED_MODULES pattern — add a module
// here whenever a new module starts calling logItemHistory().
const ALLOWED_MODULES = [
  "inventory",       // includes wine + event_supplies (same table, category-filtered)
  "itsupplies",
  "laptop",
  "vehicle",
  "contracts",
  "insurance",
  "subscriptions",
  "m365",
  "globe",
  "finance",
  "furniture",
  "users",
  "po",              // ✅ NEW — Purchase Orders
];

async function logItemHistory({
  module,
  record_id,
  action,
  field_name,
  old_value,
  new_value,
  remarks,
  performed_by_id,
  performed_by_name,
}) {
  try {
    if (!ALLOWED_MODULES.includes(module)) {
      console.error(`logItemHistory: invalid module "${module}"`);
      return;
    }
    if (!record_id || !action) {
      console.error("logItemHistory: record_id and action are required");
      return;
    }

    await pool.query(
      `INSERT INTO item_history
        (module, record_id, action, field_name, old_value, new_value, remarks, performed_by_id, performed_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        module,
        record_id,
        action,
        field_name || null,
        old_value !== undefined && old_value !== null ? String(old_value) : null,
        new_value !== undefined && new_value !== null ? String(new_value) : null,
        remarks || null,
        performed_by_id || null,
        performed_by_name || null,
      ]
    );
  } catch (err) {
    // Never let history logging break the parent request (same philosophy
    // as logAction() in utils/log.js).
    console.error("logItemHistory error:", err);
  }
}

module.exports = { logItemHistory, ALLOWED_MODULES };