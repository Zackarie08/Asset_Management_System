// backend/routes/globe.js — PLAN INCLUSIONS UPDATE
// Adds unli_allnet_calls, unli_text, freebie (data_allocation already existed).

const express = require("express");
const router  = express.Router();
const pool    = require("../db");

function computeGlobeStatus(renewalDate, storedStatus) {
  if (storedStatus === "Inactive") return "Inactive";
  if (!renewalDate) return storedStatus || "Active";
  const daysLeft = (new Date(renewalDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0)  return "Inactive";
  if (daysLeft <= 30) return "For Renewal";
  return "Active";
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, u.name AS employee_name
      FROM globe_mobile_plan g
      LEFT JOIN users u ON g.user_id = u.user_id
      ORDER BY g.plan_id DESC
    `);
    const rows = result.rows.map(r => ({ ...r, computed_status: computeGlobeStatus(r.renewal_date, r.status) }));
    res.json(rows);
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
    const row = result.rows[0];
    res.json({ ...row, computed_status: computeGlobeStatus(row.renewal_date, row.status) });
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
      start_date, renewal_date, status, remarks,
      unli_allnet_calls, unli_text, freebie,   // ✅ NEW
    } = req.body;

    if (!mobile_number) return res.status(400).json({ error: "mobile_number is required" });

    const result = await pool.query(`
      INSERT INTO globe_mobile_plan (
        user_id, mobile_number, account_number, plan_name,
        data_allocation, monthly_cost, credit_limit,
        start_date, renewal_date, status, remarks,
        unli_allnet_calls, unli_text, freebie
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      user_id || null, mobile_number, account_number || null, plan_name || null,
      data_allocation || null, monthly_cost || null, credit_limit || null,
      start_date || null, renewal_date || null, status || "Active", remarks || null,
      !!unli_allnet_calls, !!unli_text, freebie || null,
    ]);

    res.json(result.rows[0]);
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
      start_date, renewal_date, status, remarks,
      unli_allnet_calls, unli_text, freebie,   // ✅ NEW
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
        start_date         = $8,
        renewal_date       = $9,
        status             = $10,
        remarks            = $11,
        unli_allnet_calls  = $12,
        unli_text          = $13,
        freebie            = $14
      WHERE plan_id = $15
      RETURNING *
    `, [
      user_id || null, mobile_number, account_number || null, plan_name || null,
      data_allocation || null, monthly_cost || null, credit_limit || null,
      start_date || null, renewal_date || null, status || "Active", remarks || null,
      !!unli_allnet_calls, !!unli_text, freebie || null,
      req.params.id,
    ]);

    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });
    res.json(result.rows[0]);
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