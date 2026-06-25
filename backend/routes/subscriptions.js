// backend/routes/subscriptions.js — REFACTORED
// Changes:
//   • New schema: subscription_name, supplier, billing_cycle
//   • GET /api/subscriptions/:id  (was missing)
//   • Auto-status: Expired / Expiring Soon / Active
//   • assigned_user_id FK support
//   • Consistent error handling

const express = require("express");
const router  = express.Router();
const pool    = require("../db");

// ── helpers ────────────────────────────────────────────────

function computeSubStatus(expiryDate, storedStatus) {
  if (storedStatus === "Cancelled") return "Cancelled";
  if (!expiryDate) return storedStatus || "Active";

  const daysLeft = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0)  return "Expired";
  if (daysLeft <= 30) return "Expiring Soon";
  return storedStatus || "Active";
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

    const rows = result.rows.map(r => ({
      ...r,
      computed_status: computeSubStatus(r.expiry_date, r.status),
    }));

    res.json(rows);
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

    if (!result.rows.length) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const row = result.rows[0];
    res.json({ ...row, computed_status: computeSubStatus(row.expiry_date, row.status) });
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
      start_date,
      expiry_date,
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
        start_date, expiry_date, status, remarks
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      subscription_name,
      category,
      supplier || null,
      assigned_user_id || null,
      assigned_to || null,
      monthly_cost || null,
      billing_cycle || "monthly",
      start_date || null,
      expiry_date || null,
      status || "Active",
      remarks || null,
    ]);

    res.json(result.rows[0]);
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
      start_date,
      expiry_date,
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
        start_date        = $8,
        expiry_date       = $9,
        status            = $10,
        remarks           = $11,
        updated_at        = NOW()
      WHERE subscription_id = $12
      RETURNING *
    `, [
      subscription_name,
      category,
      supplier || null,
      assigned_user_id || null,
      assigned_to || null,
      monthly_cost || null,
      billing_cycle || "monthly",
      start_date || null,
      expiry_date || null,
      status || "Active",
      remarks || null,
      req.params.id,
    ]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.json(result.rows[0]);
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

    if (!result.rows.length) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.json({ deleted: result.rows[0].subscription_id });
  } catch (err) {
    console.error("Subscriptions DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

module.exports = router;
