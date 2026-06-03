const express = require("express");
const router = express.Router();
const pool = require("../db");
const logAction = require("../utils/log");

// ✅ GET ALL LOGS

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.name 
       FROM system_log l
       LEFT JOIN users u ON l.user_id = u.user_id
       ORDER BY l.date_time DESC`
    );

    res.json(result.rows);

  } catch (err) {
    console.error("🔥 LOG FETCH ERROR:", err); // ✅ SHOW REAL ERROR
    res.status(500).send("Error fetching logs");
  }
});


// ✅ SAVE LOG
router.post("/", async (req, res) => {
  try {
    await logAction(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving log");
  }
});


module.exports = router;