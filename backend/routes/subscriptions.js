// backend/routes/subscriptions.js — RENEWAL SYSTEM UPDATE
// See Other_Subscription_Renewal_System.md
//
// Changes:
//   • start_date/expiry_date replaced by renewal_date (see migration
//     003_subscription_insurance_updates.sql — adds the column and
//     backfills it from the old expiry_date).
//   • Status is now computed from renewal_date + billing_cycle:
//       - one-time: never recurs; becomes "Expired" once past, no
//         further alerts.
//       - monthly/yearly: recurs every cycle; "For Renewal" while
//         within the 3-day-before→on-date alert window.

const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { computeRenewalAlert } = require("../utils/renewalAlerts");

function computeSubStatus(renewalDate, billingCycle, storedStatus) {
  if (storedStatus === "Cancelled") return "Cancelled";
  if (!renewalDate) return storedStatus || "Active";

  const alert = computeRenewalAlert(renewalDate, billingCycle);
  if (billingCycle === "one-time" && alert.isPastOneTime) return "Expired";
  if (alert.alertActive) return "For Renewal";
  return storedStatus || "Active";
}

function withComputed(row) {
  const alert = computeRenewalAlert(row.renewal_date, row.billing_cycle);
  return {
    ...row,
    computed_status: computeSubStatus(row.renewal_date, row.billing_cycle, row.status),
    renewal_alert_active: alert.alertActive,
    renewal_days_until: alert.daysUntil,
    next_renewal_date: alert.nextDate,
  };
}

// ── GET ALL ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        u.name  AS assigned_user_name
      FROM subscriptions s
      LEFT JOIN users u ON s.assigned_user_id = u.user_id
      ORDER BY s.subscription_id DESC
    `);
    res.json(result.rows.map(withComputed));
  } catch (err) {
    console.error("Subscriptions GET /", err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// ── GET ONE ────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        u.name AS assigned_user_name
      FROM subscriptions s
      LEFT JOIN users u ON s.assigned_user_id = u.user_id
      WHERE s.subscription_id = $1
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: "Subscription not found" });
    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("Subscriptions GET /:id", err);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// ── CREATE ─────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      subscription_name,
      category,
      supplier,
      assigned_user_id,
      assigned_to,
      monthly_cost,
      billing_cycle,
      renewal_date,
      status,
      remarks,
    } = req.body;

    if (!subscription_name || !category) {
      return res.status(400).json({ error: "subscription_name and category are required" });
    }

    const result = await pool.query(`
      INSERT INTO subscriptions (
        subscription_name, category, supplier,
        assigned_user_id, assigned_to,
        monthly_cost, billing_cycle,
        renewal_date, status, remarks
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      subscription_name,
      category,
      supplier || null,
      assigned_user_id || null,
      assigned_to || null,
      monthly_cost || null,
      billing_cycle || "monthly",
      renewal_date || null,
      status || "Active",
      remarks || null,
    ]);

    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("Subscriptions POST /", err);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

// ── UPDATE ─────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const {
      subscription_name,
      category,
      supplier,
      assigned_user_id,
      assigned_to,
      monthly_cost,
      billing_cycle,
      renewal_date,
      status,
      remarks,
    } = req.body;

    const result = await pool.query(`
      UPDATE subscriptions SET
        subscription_name = $1,
        category          = $2,
        supplier          = $3,
        assigned_user_id  = $4,
        assigned_to       = $5,
        monthly_cost      = $6,
        billing_cycle     = $7,
        renewal_date      = $8,
        status            = $9,
        remarks           = $10,
        updated_at        = NOW()
      WHERE subscription_id = $11
      RETURNING *
    `, [
      subscription_name,
      category,
      supplier || null,
      assigned_user_id || null,
      assigned_to || null,
      monthly_cost || null,
      billing_cycle || "monthly",
      renewal_date || null,
      status || "Active",
      remarks || null,
      req.params.id,
    ]);

    if (!result.rows.length) return res.status(404).json({ error: "Subscription not found" });
    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("Subscriptions PUT /:id", err);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

// ── DELETE ─────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM subscriptions WHERE subscription_id = $1 RETURNING subscription_id",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Subscription not found" });
    res.json({ deleted: result.rows[0].subscription_id });
  } catch (err) {
    console.error("Subscriptions DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

module.exports = router;