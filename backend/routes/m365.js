// backend/routes/m365.js — Main + Assignment History added
const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { computeRenewalAlert } = require("../utils/renewalAlerts");
const { logItemHistory } = require("../utils/itemHistory");
const { numChanged } = require("../utils/itemHistory"); 

function licenseStatusLabel(licensed) {
  return licensed ? "Licensed" : "No License";
}

function withComputed(row) {
  const alert = computeRenewalAlert(row.renewal_date, "yearly");
  return {
    ...row,
    computed_status: licenseStatusLabel(row.licensed),
    renewal_alert_active: alert.alertActive,
    renewal_days_until: alert.daysUntil,
    next_renewal_date: alert.nextDate,
  };
}

// ── GET ALL ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, u.name AS assigned_user_name, u.email AS assigned_user_email
      FROM m365 m
      LEFT JOIN users u ON m.assigned_user_id = u.user_id
      ORDER BY m.license_id DESC
    `);
    res.json(result.rows.map(withComputed));
  } catch (err) {
    console.error("M365 GET /", err);
    res.status(500).json({ error: "Failed to fetch M365 licenses" });
  }
});

// ── GET ONE ────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, u.name AS assigned_user_name, u.email AS assigned_user_email
      FROM m365 m
      LEFT JOIN users u ON m.assigned_user_id = u.user_id
      WHERE m.license_id = $1
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: "License not found" });
    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("M365 GET /:id", err);
    res.status(500).json({ error: "Failed to fetch license" });
  }
});

// ── CREATE ─────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      assigned_user_id, assigned_email, license_type,
      monthly_cost, license_cost, renewal_date, remarks, licensed,
      user_id, performed_by,
    } = req.body;

    if (!assigned_email || !license_type) {
      return res.status(400).json({ error: "assigned_email and license_type are required" });
    }

    const cost      = monthly_cost ?? license_cost ?? null;
    const isLicensed = licensed === undefined ? true : !!licensed;

    let assignedName = null;
    if (assigned_user_id) {
      const uRes = await pool.query("SELECT name FROM users WHERE user_id=$1", [assigned_user_id]);
      assignedName = uRes.rows[0]?.name || null;
    }

    const result = await pool.query(`
      INSERT INTO m365 (
        assigned_user_id, assigned_email, license_type,
        license_cost, monthly_cost, renewal_date, status, remarks, licensed
      ) VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      assigned_user_id || null, assigned_email, license_type, cost,
      renewal_date || null, isLicensed ? "Active" : "Inactive",
      remarks || null, isLicensed,
    ]);

    await logItemHistory({
      module: "m365",
      record_id: result.rows[0].license_id,
      action: "CREATED",
      remarks: `${assigned_email} · ${license_type}${assignedName ? ' · assigned to ' + assignedName : ''}`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("M365 POST /", err);
    res.status(500).json({ error: "Failed to create license" });
  }
});

// ── UPDATE ─────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const {
      assigned_user_id, assigned_email, license_type,
      monthly_cost, license_cost, renewal_date, remarks, licensed,
      user_id, performed_by,
    } = req.body;

    const cost      = monthly_cost ?? license_cost ?? null;
    const isLicensed = licensed === undefined ? true : !!licensed;

    const before = await pool.query(`
      SELECT m.*, u.name AS assigned_user_name FROM m365 m
      LEFT JOIN users u ON m.assigned_user_id = u.user_id
      WHERE m.license_id=$1
    `, [req.params.id]);
    const old = before.rows[0];

    let newAssignedName = null;
    if (assigned_user_id) {
      const uRes = await pool.query("SELECT name FROM users WHERE user_id=$1", [assigned_user_id]);
      newAssignedName = uRes.rows[0]?.name || null;
    }

    const result = await pool.query(`
      UPDATE m365 SET
        assigned_user_id = $1, assigned_email = $2, license_type = $3,
        license_cost = $4, monthly_cost = $4, renewal_date = $5,
        status = $6, remarks = $7, licensed = $8
      WHERE license_id = $9
      RETURNING *
    `, [
      assigned_user_id || null, assigned_email, license_type, cost,
      renewal_date || null, isLicensed ? "Active" : "Inactive",
      remarks || null, isLicensed, req.params.id,
    ]);

    if (!result.rows.length) return res.status(404).json({ error: "License not found" });

    if (old) {
      // ✅ Assignment history — snapshot names, never IDs
      if (String(old.assigned_user_id ?? '') !== String(assigned_user_id ?? '')) {
        await logItemHistory({
          module: "m365",
          record_id: req.params.id,
          action: assigned_user_id ? "ASSIGNED" : "UNASSIGNED",
          field_name: "assigned_user",
          old_value: old.assigned_user_name,
          new_value: newAssignedName,
          performed_by_id: user_id || null,
          performed_by_name: performed_by || null,
        });
      }
      const fieldChecks = [
        ["license_type", old.license_type, license_type, false],
        ["licensed", old.licensed, isLicensed, false],
        ["monthly_cost", old.monthly_cost, cost, true],
      ];

      for (const [field, oldVal, newVal, isNum] of fieldChecks) {
        const changed = isNum
          ? numChanged(oldVal, newVal)
          : String(oldVal ?? '') !== String(newVal ?? '');

        if (changed) {
          await logItemHistory({
            module: "m365",
            record_id: req.params.id,
            action: "EDITED",
            field_name: field,
            old_value: oldVal,
            new_value: newVal,
            performed_by_id: user_id || null,
            performed_by_name: performed_by || null,
          });
        }
      }
    }

    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("M365 PUT /:id", err);
    res.status(500).json({ error: "Failed to update license" });
  }
});

// ── DELETE ─────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const existing = await pool.query("SELECT assigned_email FROM m365 WHERE license_id=$1", [req.params.id]);
    const result = await pool.query(
      "DELETE FROM m365 WHERE license_id = $1 RETURNING license_id",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "License not found" });

    await logItemHistory({
      module: "m365",
      record_id: req.params.id,
      action: "DELETED",
      remarks: existing.rows[0]?.assigned_email || null,
    });

    res.json({ deleted: result.rows[0].license_id });
  } catch (err) {
    console.error("M365 DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete license" });
  }
});

module.exports = router;