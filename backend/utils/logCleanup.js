// backend/utils/logCleanup.js
// Deletes system_log rows older than 30 days.
// Called once on server startup and then on a recurring interval
// (see server.js) so the log table maintains itself with no manual
// intervention.

const pool = require("../db");

const RETENTION_DAYS = 30;

async function cleanupOldLogs() {
  try {
    const result = await pool.query(
      `DELETE FROM system_log
       WHERE date_time < NOW() - INTERVAL '${RETENTION_DAYS} days'
       RETURNING log_id`
    );

    if (result.rowCount > 0) {
      console.log(`🧹 Log cleanup: removed ${result.rowCount} log(s) older than ${RETENTION_DAYS} days`);
    }
  } catch (err) {
    console.error("Log cleanup error:", err);
  }
}

module.exports = cleanupOldLogs;
