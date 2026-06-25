// backend/routes/subscriptionsMaster.js
// Serves the unified v_subscriptions_master view.
// Read-only — writes go through individual module routes.

const express = require("express");
const router  = express.Router();
const pool    = require("../db");

// ── GET all (unified view) ─────────────────────────────────
// Supports optional query params:
//   ?status=Active|Expired|Expiring Soon
//   ?source=M365|Globe|Subscription
router.get("/", async (req, res) => {
  try {
    const conditions = [];
    const values     = [];

    if (req.query.status) {
      values.push(req.query.status);
      conditions.push(`status = $${values.length}`);
    }

    if (req.query.source) {
      values.push(req.query.source);
      conditions.push(`source = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT * FROM v_subscriptions_master ${where} ORDER BY source, assigned_to`,
      values
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Master subscriptions GET /", err);
    res.status(500).json({ error: "Failed to fetch master subscriptions" });
  }
});

// ── GET summary stats (for dashboard cards) ───────────────
router.get("/stats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)                                            AS total,
        COUNT(*) FILTER (WHERE status = 'Active')          AS active,
        COUNT(*) FILTER (WHERE status = 'Expired')         AS expired,
        COUNT(*) FILTER (WHERE status = 'Expiring Soon'
                             OR status = 'For Renewal')    AS expiring_soon,
        SUM(monthly_cost)
          FILTER (WHERE status = 'Active')                 AS total_monthly_cost,
        COUNT(*) FILTER (WHERE source = 'M365')            AS m365_count,
        COUNT(*) FILTER (WHERE source = 'Globe')           AS globe_count,
        COUNT(*) FILTER (WHERE source = 'Subscription')    AS sub_count
      FROM v_subscriptions_master
    `);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Master subscriptions GET /stats", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
