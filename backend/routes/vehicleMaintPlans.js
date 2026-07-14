// backend/routes/vehicleMaintPlans.js — Part 4 (maintenance plan rework)
// See Vehicle_Maintenance_Rework.md
//
// Changes:
//   ✅ BUG FIX: POST /perform/:maint_type_id always stamped last_performed_date
//      with the SERVER'S today's date, ignoring whatever date the user
//      actually entered (backdated/future entries were silently corrupted).
//      Now honors req.body.performed_date, falling back to today only when
//      none is supplied.
//   ✅ REMOVED: "week" interval option and the free-form "Every N" quantity
//      input — time-based plans are now Monthly or Yearly only, interval
//      value is always 1 (i.e. "every month" / "every year", not
//      "every N months/years").
//   ✅ NEW: wired into Global Item History (module "vehicle") for plan
//      create/edit/delete/perform.

const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

const VALID_TIME_UNITS = ["month", "year"]; // ✅ "week" removed

/* ── GET plans for a vehicle ──────────────────────────────── */
router.get("/:vehicle_id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        vmt.*,
        vm.maintenance_date  AS last_performed_date_actual,
        vm.odometer          AS last_performed_km
      FROM vehicle_maintenance_types vmt
      LEFT JOIN LATERAL (
        SELECT maintenance_date, odometer
        FROM vehicle_maintenance
        WHERE vehicle_id = vmt.vehicle_id
          AND service_type = vmt.name
        ORDER BY maintenance_date DESC
        LIMIT 1
      ) vm ON true
      WHERE vmt.vehicle_id = $1
      ORDER BY vmt.created_at ASC
    `, [req.params.vehicle_id]);

    const rows = result.rows.map(p => computeNextDue(p));
    res.json(rows);
  } catch (err) {
    console.error("Plans GET /:vehicle_id", err);
    res.status(500).json({ error: "Failed to fetch maintenance plans" });
  }
});

/* ── CREATE plan ──────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      vehicle_id, name, basis, threshold_km, last_maintenance_km,
      interval_unit, last_performed_date, user_id, performed_by,
    } = req.body;

    if (!vehicle_id || !name || !basis) {
      return res.status(400).json({ error: "vehicle_id, name, and basis are required" });
    }
    if (basis !== "odometer" && basis !== "time") {
      return res.status(400).json({ error: "basis must be 'odometer' or 'time'" });
    }
    // ✅ FIX: only month/year accepted now — week removed
    if (basis === "time" && !VALID_TIME_UNITS.includes(interval_unit)) {
      return res.status(400).json({ error: "interval_unit must be 'month' or 'year'" });
    }

    const result = await pool.query(`
      INSERT INTO vehicle_maintenance_types
        (vehicle_id, name, basis, threshold_km, last_maintenance_km, interval_unit, interval_value, last_performed_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      vehicle_id, name, basis,
      basis === "odometer" ? (threshold_km || null) : null,
      basis === "odometer" ? (last_maintenance_km || 0) : null,
      basis === "time" ? interval_unit : null,
      basis === "time" ? 1 : null, // ✅ FIX: always 1 — "Every N" removed
      last_performed_date || null,
    ]);

    await logItemHistory({
      module: "vehicle",
      record_id: vehicle_id,
      action: "CREATED",
      field_name: "maintenance_plan",
      new_value: `${name} (${basis === "time" ? `every ${interval_unit}` : `every ${threshold_km} km`})`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

    res.json(computeNextDue(result.rows[0]));
  } catch (err) {
    console.error("Plans POST /", err);
    res.status(500).json({ error: "Failed to create maintenance plan" });
  }
});

/* ── UPDATE plan ──────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const {
      name, basis, threshold_km, last_maintenance_km,
      interval_unit, last_performed_date, user_id, performed_by,
    } = req.body;

    if (basis === "time" && !VALID_TIME_UNITS.includes(interval_unit)) {
      return res.status(400).json({ error: "interval_unit must be 'month' or 'year'" });
    }

    const before = await pool.query("SELECT * FROM vehicle_maintenance_types WHERE maint_type_id=$1", [req.params.id]);
    const old = before.rows[0];

    const result = await pool.query(`
      UPDATE vehicle_maintenance_types SET
        name                = $1,
        basis               = $2,
        threshold_km        = $3,
        last_maintenance_km = $4,
        interval_unit       = $5,
        interval_value      = $6,
        last_performed_date = $7
      WHERE maint_type_id = $8
      RETURNING *
    `, [name, basis, threshold_km || null, last_maintenance_km || null,
        basis === "time" ? interval_unit : null,
        basis === "time" ? 1 : null,
        last_performed_date || null, req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });

    if (old) {
      await logItemHistory({
        module: "vehicle",
        record_id: old.vehicle_id,
        action: "EDITED",
        field_name: "maintenance_plan",
        old_value: `${old.name} (${old.basis})`,
        new_value: `${name} (${basis})`,
        performed_by_id: user_id || null,
        performed_by_name: performed_by || null,
      });
    }

    res.json(computeNextDue(result.rows[0]));
  } catch (err) {
    console.error("Plans PUT /:id", err);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

/* ── DELETE plan ──────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM vehicle_maintenance_types WHERE maint_type_id=$1 RETURNING maint_type_id, vehicle_id, name",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });

    await logItemHistory({
      module: "vehicle",
      record_id: result.rows[0].vehicle_id,
      action: "EDITED",
      field_name: "maintenance_plan",
      old_value: result.rows[0].name,
      new_value: null,
      remarks: "Maintenance plan deleted",
    });

    res.json({ deleted: result.rows[0].maint_type_id });
  } catch (err) {
    console.error("Plans DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

/* ── RECORD MAINTENANCE + advance plan cycle ──────────────── */
// POST /api/vehicle-plans/perform/:maint_type_id
// Body: { vehicle_id, odometer, remarks, maintenance_cost, performed_by, performed_date }
router.post("/perform/:maint_type_id", async (req, res) => {
  try {
    const { vehicle_id, odometer, remarks, maintenance_cost, performed_by, performed_date } = req.body;
    const id = req.params.maint_type_id;

    const planRes = await pool.query(
      "SELECT * FROM vehicle_maintenance_types WHERE maint_type_id=$1",
      [id]
    );
    if (!planRes.rows.length) return res.status(404).json({ error: "Plan not found" });
    const plan = planRes.rows[0];

    // ✅ BUG FIX: honor the actual date the user recorded. Previously this
    // was hardcoded to `new Date()...` (server "today"), which silently
    // overwrote backdated/future maintenance dates and corrupted every
    // subsequent next-due calculation for time-based plans.
    const effectiveDate = performed_date || new Date().toISOString().slice(0, 10);

    await pool.query(`
      INSERT INTO vehicle_maintenance
        (vehicle_id, service_type, maintenance_date, maintenance_cost, odometer, remarks, performed_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [vehicle_id, plan.name, effectiveDate, maintenance_cost || null, odometer || null, remarks || null, performed_by || null]);

    if (plan.basis === "odometer" && odometer) {
      await pool.query(
        "UPDATE vehicle_maintenance_types SET last_maintenance_km=$1, last_performed_date=$2 WHERE maint_type_id=$3",
        [parseInt(odometer), effectiveDate, id]
      );
      await pool.query(
        "UPDATE vehicle SET odometer=$1, last_maintenance_km=$1 WHERE vehicle_id=$2",
        [parseInt(odometer), vehicle_id]
      );
    }

    if (plan.basis === "time") {
      await pool.query(
        "UPDATE vehicle_maintenance_types SET last_performed_date=$1 WHERE maint_type_id=$2",
        [effectiveDate, id]
      );
    }

    await logItemHistory({
      module: "vehicle",
      record_id: vehicle_id,
      action: "MAINTENANCE_PERFORMED",
      remarks: `${plan.name} performed on ${effectiveDate}${remarks ? ' — ' + remarks : ''}`,
      performed_by_name: performed_by || null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Plans POST /perform", err);
    res.status(500).json({ error: "Failed to record maintenance" });
  }
});

/* ── Helper: compute next_due and status for a plan ──────── */
// ✅ FIX: already correctly based next-due off last_performed_date (not
// "today") — the actual bug was upstream, in /perform writing the wrong
// date into last_performed_date in the first place (fixed above). "week"
// branch removed per the interval-options simplification.
function computeNextDue(plan) {
  const p = { ...plan };

  if (p.basis === "odometer") {
    const base = parseInt(p.last_maintenance_km || 0);
    const threshold = parseInt(p.threshold_km || 0);
    p.next_due_km = base + threshold;
    p.next_due_date = null;
    p.status_computed = "unknown"; // needs current odometer from vehicle
  } else if (p.basis === "time") {
    if (!p.last_performed_date) {
      p.next_due_date = null;
      p.status_computed = "pending";
    } else {
      const last = new Date(p.last_performed_date);
      const next = new Date(last);
      if (p.interval_unit === "month") {
        next.setMonth(next.getMonth() + 1);
      } else { // "year" (default / only remaining option besides month)
        next.setFullYear(next.getFullYear() + 1);
      }
      p.next_due_date = next.toISOString().slice(0, 10);
      const daysLeft = Math.ceil((next - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) p.status_computed = "overdue";
      else if (daysLeft <= 7) p.status_computed = "due_soon";
      else p.status_computed = "ok";
    }
  }

  return p;
}

module.exports = router;