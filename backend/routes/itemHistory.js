// backend/routes/itemHistory.js — IMMUTABILITY FIX
// See Global_Item_History_Immutability_Review.md
//
// FIX: previously LEFT JOINed `users` to produce a live `current_user_name`,
// and the frontend preferred that live value over the stored snapshot —
// meaning a user rename or deletion would retroactively alter every past
// history entry involving them. Removed entirely. `performed_by_name`
// (captured at write time by utils/itemHistory.js) is now the ONLY source
// of "who" for any history row, forever.

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
      `SELECT * FROM item_history
       WHERE module = $1 AND record_id = $2
       ORDER BY created_at DESC`,
      [module, record_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("ItemHistory GET /:module/:record_id", err);
    res.status(500).json({ error: "Failed to fetch item history" });
  }
});

module.exports = router;