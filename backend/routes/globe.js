// backend/routes/globe.js — STATUS AUDIT FIX
// See Globe_Status_Audit.md
//
// ROOT CAUSE of "Status = Active but list/DP shows Inactive/blank":
// the old computeGlobeStatus() derived a DIFFERENT status from
// renewal_date proximity and silently overrode whatever the admin
// had explicitly selected in the Status dropdown. Fix: the displayed
// status is now exactly the stored `status` column. Renewal proximity
// is still tracked, but surfaced as a separate `renewal_alert_active`
// flag instead of mutating status.
//
// Also: start_date is no longer written (dropped from the Add/Edit
// form); renewal_date is retained (Globe still renews yearly).

const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { computeRenewalAlert } = require("../utils/renewalAlerts");

function withComputed(row) {
  const alert = computeRenewalAlert(row.renewal_date, "yearly");
  return {
    ...row,
    computed_status: row.status || "Active", // ✅ FIX: no longer derived/overridden
    renewal_alert_active: row.status !== "Inactive" && alert.alertActive,
    renewal_days_until: alert.daysUntil,
    next_renewal_date: alert.nextDate,
  };
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, u.name AS employee_name
      FROM globe_mobile_plan g
      LEFT JOIN users u ON g.user_id = u.user_id
      ORDER BY g.plan_id DESC
    `);
    res.json(result.rows.map(withComputed));
  } catch (err) {
    console.error("Globe GET /", err);
    res.status(500).json({ error: "Failed to fetch Globe plans" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, u.name AS employee_name
      FROM globe_mobile_plan g
      LEFT JOIN users u ON g.user_id = u.user_id
      WHERE g.plan_id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });
    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("Globe GET /:id", err);
    res.status(500).json({ error: "Failed to fetch plan" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      user_id, mobile_number, account_number, plan_name,
      data_allocation, monthly_cost, credit_limit,
      renewal_date, status, remarks,
      unli_allnet_calls, unli_text, freebie,
    } = req.body;

    if (!mobile_number) return res.status(400).json({ error: "mobile_number is required" });

    const result = await pool.query(`
      INSERT INTO globe_mobile_plan (
        user_id, mobile_number, account_number, plan_name,
        data_allocation, monthly_cost, credit_limit,
        renewal_date, status, remarks,
        unli_allnet_calls, unli_text, freebie
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      user_id || null, mobile_number, account_number || null, plan_name || null,
      data_allocation || null, monthly_cost || null, credit_limit || null,
      renewal_date || null, status || "Active", remarks || null,
      !!unli_allnet_calls, !!unli_text, freebie || null,
    ]);

    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("Globe POST /", err);
    res.status(500).json({ error: "Failed to create plan" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const {
      user_id, mobile_number, account_number, plan_name,
      data_allocation, monthly_cost, credit_limit,
      renewal_date, status, remarks,
      unli_allnet_calls, unli_text, freebie,
    } = req.body;

    const result = await pool.query(`
      UPDATE globe_mobile_plan SET
        user_id            = $1,
        mobile_number      = $2,
        account_number     = $3,
        plan_name          = $4,
        data_allocation    = $5,
        monthly_cost       = $6,
        credit_limit       = $7,
        renewal_date       = $8,
        status             = $9,
        remarks            = $10,
        unli_allnet_calls  = $11,
        unli_text          = $12,
        freebie            = $13
      WHERE plan_id = $14
      RETURNING *
    `, [
      user_id || null, mobile_number, account_number || null, plan_name || null,
      data_allocation || null, monthly_cost || null, credit_limit || null,
      renewal_date || null, status || "Active", remarks || null,
      !!unli_allnet_calls, !!unli_text, freebie || null,
      req.params.id,
    ]);

    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });
    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("Globe PUT /:id", err);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM globe_mobile_plan WHERE plan_id = $1 RETURNING plan_id",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });
    res.json({ deleted: result.rows[0].plan_id });
  } catch (err) {
    console.error("Globe DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

module.exports = router;