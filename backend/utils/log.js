const pool = require("../db");

async function logAction({
  user_id,
  action_type,
  module,
  description,
  quantity,
  movement_type,
  reference_type,
  performed_by
}) {
  try {
    await pool.query(
      `INSERT INTO system_log 
      (user_id, action_type, module, description, quantity, movement_type, reference_type, performed_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [user_id, action_type, module, description, quantity, movement_type, reference_type, performed_by]
    );
  } catch (err) {
    console.error("Log error:", err);
  }
}

module.exports = logAction;
