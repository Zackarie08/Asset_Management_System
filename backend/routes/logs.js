const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET ALL LOGS
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM system_log ORDER BY date_time DESC"
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching logs");
  }
});

module.exports = router;