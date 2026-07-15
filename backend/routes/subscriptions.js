// backend/routes/subscriptions.js — Main + Assignment History added
const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { computeRenewalAlert } = require("../utils/renewalAlerts");
const { logItemHistory } = require("../utils/itemHistory");

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
      SELECT s.*, u.name AS assigned_user_name
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
      SELECT s.*, u.name AS assigned_user_name
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
      subscription_name, category, supplier,
      assigned_user_id, assigned_to,
      monthly_cost, billing_cycle, renewal_date, status, remarks,
      performed_by,
    } = req.body;

    if (!subscription_name || !category) {
      return res.status(400).json({ error: "subscription_name and category are required" });
    }

    let assignedName = null;
    if (assigned_user_id) {
      const uRes = await pool.query("SELECT name FROM users WHERE user_id=$1", [assigned_user_id]);
      assignedName = uRes.rows[0]?.name || null;
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
      subscription_name, category, supplier || null,
      assigned_user_id || null, assigned_to || null,
      monthly_cost || null, billing_cycle || "monthly",
      renewal_date || null, status || "Active", remarks || null,
    ]);

    await logItemHistory({
      module: "subscriptions",
      record_id: result.rows[0].subscription_id,
      action: "CREATED",
      remarks: `${subscription_name} · ${category}${assignedName ? ' · assigned to ' + assignedName : assigned_to ? ' · assigned to ' + assigned_to : ''}`,
      performed_by_name: performed_by || null,
    });

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
      subscription_name, category, supplier,
      assigned_user_id, assigned_to,
      monthly_cost, billing_cycle, renewal_date, status, remarks,
      performed_by,
    } = req.body;

    const before = await pool.query(`
      SELECT s.*, u.name AS assigned_user_name FROM subscriptions s
      LEFT JOIN users u ON s.assigned_user_id = u.user_id WHERE s.subscription_id=$1
    `, [req.params.id]);
    const old = before.rows[0];

    let newAssignedName = null;
    if (assigned_user_id) {
      const uRes = await pool.query("SELECT name FROM users WHERE user_id=$1", [assigned_user_id]);
      newAssignedName = uRes.rows[0]?.name || null;
    }

    const result = await pool.query(`
      UPDATE subscriptions SET
        subscription_name = $1, category = $2, supplier = $3,
        assigned_user_id = $4, assigned_to = $5,
        monthly_cost = $6, billing_cycle = $7,
        renewal_date = $8, status = $9, remarks = $10,
        updated_at = NOW()
      WHERE subscription_id = $11
      RETURNING *
    `, [
      subscription_name, category, supplier || null,
      assigned_user_id || null, assigned_to || null,
      monthly_cost || null, billing_cycle || "monthly",
      renewal_date || null, status || "Active", remarks || null,
      req.params.id,
    ]);

    if (!result.rows.length) return res.status(404).json({ error: "Subscription not found" });

    if (old) {
      // ✅ Assignment history — covers both the FK (assigned_user_id) and
      // the free-text (assigned_to) assignment paths this table supports.
      const oldAssignedLabel = old.assigned_user_name || old.assigned_to || null;
      const newAssignedLabel = newAssignedName || assigned_to || null;
      if (String(oldAssignedLabel ?? '') !== String(newAssignedLabel ?? '')) {
        await logItemHistory({
          module: "subscriptions",
          record_id: req.params.id,
          action: newAssignedLabel ? "ASSIGNED" : "UNASSIGNED",
          field_name: "assigned_to",
          old_value: oldAssignedLabel,
          new_value: newAssignedLabel,
          performed_by_name: performed_by || null,
        });
      }
      const fieldChecks = [
        ["subscription_name", old.subscription_name, subscription_name],
        ["status", old.status, status],
        ["monthly_cost", old.monthly_cost, monthly_cost],
        ["billing_cycle", old.billing_cycle, billing_cycle],
      ];
      for (const [field, oldVal, newVal] of fieldChecks) {
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          await logItemHistory({
            module: "subscriptions",
            record_id: req.params.id,
            action: field === "status" ? "STATUS_CHANGED" : "EDITED",
            field_name: field,
            old_value: oldVal,
            new_value: newVal,
            performed_by_name: performed_by || null,
          });
        }
      }
    }

    res.json(withComputed(result.rows[0]));
  } catch (err) {
    console.error("Subscriptions PUT /:id", err);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

// ── DELETE ─────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const existing = await pool.query("SELECT subscription_name FROM subscriptions WHERE subscription_id=$1", [req.params.id]);
    const result = await pool.query(
      "DELETE FROM subscriptions WHERE subscription_id = $1 RETURNING subscription_id",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Subscription not found" });

    await logItemHistory({
      module: "subscriptions",
      record_id: req.params.id,
      action: "DELETED",
      remarks: existing.rows[0]?.subscription_name || null,
    });

    res.json({ deleted: result.rows[0].subscription_id });
  } catch (err) {
    console.error("Subscriptions DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

module.exports = router;