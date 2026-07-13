// backend/routes/itemHistory.js — Part 8
// Read-only endpoint. Writes always go through utils/itemHistory.js's
// logItemHistory(), called inline from each module's own route file —
// never written to directly here.

const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { ALLOWED_MODULES } = require("../utils/itemHistory");

// GET /api/item-history/:module/:record_id
router.get("/:module/:record_id", async (req, res) => {
  try {
    const { module, record_id } = req.params;

    if (!ALLOWED_MODULES.includes(module)) {
      return res.status(400).json({ error: "Invalid module" });
    }

    const result = await pool.query(
      `SELECT
         h.*,
         u.name AS current_user_name  -- live name lookup, falls back to the
       FROM item_history h            -- denormalized performed_by_name if the
       LEFT JOIN users u ON h.performed_by_id = u.user_id  -- user was deleted
       WHERE h.module = $1 AND h.record_id = $2
       ORDER BY h.created_at DESC`,
      [module, record_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("ItemHistory GET /:module/:record_id", err);
    res.status(500).json({ error: "Failed to fetch item history" });
  }
});

module.exports = router;
