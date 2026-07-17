// backend/routes/globe.js — Main + Assignment History added
const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { computeRenewalAlert } = require("../utils/renewalAlerts");
const { logItemHistory } = require("../utils/itemHistory");
const { numChanged } = require("../utils/itemHistory"); 

function withComputed(row) {
  const alert = computeRenewalAlert(row.renewal_date, "yearly");
  return {
    ...row,
    computed_status: row.status || "Active",
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
      performed_by,
    } = req.body;

    if (!mobile_number) return res.status(400).json({ error: "mobile_number is required" });

    let employeeName = null;
    if (user_id) {
      const uRes = await pool.query("SELECT name FROM users WHERE user_id=$1", [user_id]);
      employeeName = uRes.rows[0]?.name || null;
    }

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

    await logItemHistory({
      module: "globe",
      record_id: result.rows[0].plan_id,
      action: "CREATED",
      remarks: `${plan_name || 'Globe Plan'} · ${mobile_number}${employeeName ? ' · assigned to ' + employeeName : ''}`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

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
      performed_by,
    } = req.body;

    const before = await pool.query(`
      SELECT g.*, u.name AS employee_name FROM globe_mobile_plan g
      LEFT JOIN users u ON g.user_id = u.user_id WHERE g.plan_id=$1
    `, [req.params.id]);
    const old = before.rows[0];

    let newEmployeeName = null;
    if (user_id) {
      const uRes = await pool.query("SELECT name FROM users WHERE user_id=$1", [user_id]);
      newEmployeeName = uRes.rows[0]?.name || null;
    }

    const result = await pool.query(`
      UPDATE globe_mobile_plan SET
        user_id = $1, mobile_number = $2, account_number = $3, plan_name = $4,
        data_allocation = $5, monthly_cost = $6, credit_limit = $7,
        renewal_date = $8, status = $9, remarks = $10,
        unli_allnet_calls = $11, unli_text = $12, freebie = $13
      WHERE plan_id = $14
      RETURNING *
    `, [
      user_id || null, mobile_number, account_number || null, plan_name || null,
      data_allocation || null, monthly_cost || null, credit_limit || null,
      renewal_date || null, status || "Active", remarks || null,
      !!unli_allnet_calls, !!unli_text, freebie || null, req.params.id,
    ]);

    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });

    if (old) {
      if (String(old.user_id ?? '') !== String(user_id ?? '')) {
        await logItemHistory({
          module: "globe",
          record_id: req.params.id,
          action: user_id ? "ASSIGNED" : "UNASSIGNED",
          field_name: "assigned_user",
          old_value: old.employee_name,
          new_value: newEmployeeName,
          performed_by_id: req.body.admin_id || null,
          performed_by_name: performed_by || null,
        });
      }
      const fieldChecks = [
        ["plan_name", old.plan_name, plan_name, false],
        ["status", old.status, status, false],
        ["monthly_cost", old.monthly_cost, monthly_cost, true],
      ];

      for (const [field, oldVal, newVal, isNum] of fieldChecks) {
        const changed = isNum
          ? numChanged(oldVal, newVal)
          : String(oldVal ?? '') !== String(newVal ?? '');

        if (changed) {
          await logItemHistory({
            module: "globe",
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
    console.error("Globe PUT /:id", err);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const existing = await pool.query("SELECT plan_name, mobile_number FROM globe_mobile_plan WHERE plan_id=$1", [req.params.id]);
    const result = await pool.query(
      "DELETE FROM globe_mobile_plan WHERE plan_id = $1 RETURNING plan_id",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });

    await logItemHistory({
      module: "globe",
      record_id: req.params.id,
      action: "DELETED",
      remarks: existing.rows[0] ? `${existing.rows[0].plan_name || 'Globe Plan'} · ${existing.rows[0].mobile_number}` : null,
    });

    res.json({ deleted: result.rows[0].plan_id });
  } catch (err) {
    console.error("Globe DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

module.exports = router;