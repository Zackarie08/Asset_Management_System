// backend/routes/m365.js — REFACTORED
// Changes:
//   • GET /api/m365/:id  (was missing — forced client-side .find())
//   • Auto-status logic  (Expired / Expiring Soon / Active)
//   • assigned_user_id support
//   • Consistent error handling with try/catch on every route
//   • monthly_cost synced alongside license_cost

const express = require("express");
const router  = express.Router();
const pool    = require("../db");

// ── helpers ────────────────────────────────────────────────

function computeStatus(expiryDate, rawStatus) {
  if (!expiryDate) return rawStatus || "Active";
  const daysLeft = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0)  return "Expired";
  if (daysLeft <= 30) return "Expiring Soon";
  return "Active";
}

// ── GET ALL ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.*,
        u.name  AS assigned_user_name,
        u.email AS assigned_user_email
      FROM m365 m
      LEFT JOIN users u ON m.assigned_user_id = u.user_id
      ORDER BY m.license_id DESC
    `);

    // Enrich with computed status before sending
    const rows = result.rows.map(r => ({
      ...r,
      computed_status: computeStatus(r.expiry_date, r.status),
    }));

    res.json(rows);
  } catch (err) {
    console.error("M365 GET /", err);
    res.status(500).json({ error: "Failed to fetch M365 licenses" });
  }
});

// ── GET ONE ────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.*,
        u.name  AS assigned_user_name,
        u.email AS assigned_user_email
      FROM m365 m
      LEFT JOIN users u ON m.assigned_user_id = u.user_id
      WHERE m.license_id = $1
    `, [req.params.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "License not found" });
    }

    const row = result.rows[0];
    res.json({ ...row, computed_status: computeStatus(row.expiry_date, row.status) });
  } catch (err) {
    console.error("M365 GET /:id", err);
    res.status(500).json({ error: "Failed to fetch license" });
  }
});

// ── CREATE ─────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      assigned_user_id,
      assigned_email,
      license_type,
      category,
      license_cost,
      monthly_cost,
      start_date,
      expiry_date,
      renewal_date,
      status,
      remarks,
      licensed,          // ✅ NEW — replaces Category in the UI
    } = req.body;

    if (!assigned_email || !license_type) {
      return res.status(400).json({ error: "assigned_email and license_type are required" });
    }

    const cost = monthly_cost ?? license_cost ?? null;

    const result = await pool.query(`
      INSERT INTO m365 (
        assigned_user_id, assigned_email, license_type, category,
        license_cost, monthly_cost,
        start_date, expiry_date, renewal_date, status, remarks, licensed
      ) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      assigned_user_id || null,
      assigned_email,
      license_type,
      category || null,   // kept for legacy rows only — no longer written from the UI
      cost,
      start_date || null,
      expiry_date || null,
      renewal_date || null,
      status || "Active",
      remarks || null,
      licensed === undefined ? true : !!licensed,
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("M365 POST /", err);
    res.status(500).json({ error: "Failed to create license" });
  }
});

// ── UPDATE ─────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const {
      assigned_user_id,
      assigned_email,
      license_type,
      category,
      license_cost,
      monthly_cost,
      start_date,
      expiry_date,
      renewal_date,
      status,
      remarks,
      licensed,          // ✅ NEW
    } = req.body;

    const cost = monthly_cost ?? license_cost ?? null;

    const result = await pool.query(`
      UPDATE m365 SET
        assigned_user_id = $1,
        assigned_email   = $2,
        license_type     = $3,
        category         = $4,
        license_cost     = $5,
        monthly_cost     = $5,
        start_date       = $6,
        expiry_date      = $7,
        renewal_date     = $8,
        status           = $9,
        remarks          = $10,
        licensed         = $11
      WHERE license_id = $12
      RETURNING *
    `, [
      assigned_user_id || null,
      assigned_email,
      license_type,
      category || null,
      cost,
      start_date || null,
      expiry_date || null,
      renewal_date || null,
      status || "Active",
      remarks || null,
      licensed === undefined ? true : !!licensed,
      req.params.id,
    ]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "License not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("M365 PUT /:id", err);
    res.status(500).json({ error: "Failed to update license" });
  }
});

// ── DELETE ─────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM m365 WHERE license_id = $1 RETURNING license_id",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "License not found" });
    }

    res.json({ deleted: result.rows[0].license_id });
  } catch (err) {
    console.error("M365 DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete license" });
  }
});

module.exports = router;
