// backend/routes/vehicleMaintPlans.js
// Maintenance plan management per vehicle (odometer + time based)
//
// FIX LOG (this revision):
//   • Time-based next-due calculation no longer overflows months
//     (Jan 31 + 1 month now correctly lands on Feb 28/29, not Mar 2/3).
//     Uses new Date(year, month+1, 0) to find the true last day of the
//     target month, then clamps the day-of-month to it. This also
//     naturally handles leap years with no special-casing needed.
//   • daysLeft is now computed against two midnight-normalized dates,
//     so "Due Today" is detected reliably instead of drifting based
//     on time-of-day.
//   • Added a "due_today" status so the frontend can show a distinct
//     "Due Today" badge instead of lumping it into "due_soon".
//   • Odometer-based maintenance now writes the vehicle's baseline
//     using GREATEST() so a retroactive/lower maintenance odometer
//     entry can never pull the vehicle's live odometer backward.
//     The plan's own baseline still stores the exact entered value.

const express = require("express");
const router  = express.Router();
const pool    = require("../db");

/* ── GET plans for a vehicle ──────────────────────────────── */
router.get("/:vehicle_id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        vmt.*,
        vm.maintenance_date  AS last_performed_date,
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

    // Compute next_due for each plan
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
    const { vehicle_id, name, basis, threshold_km, last_maintenance_km, interval_unit, interval_value, last_performed_date } = req.body;

    if (!vehicle_id || !name || !basis) {
      return res.status(400).json({ error: "vehicle_id, name, and basis are required" });
    }
    if (basis !== "odometer" && basis !== "time") {
      return res.status(400).json({ error: "basis must be 'odometer' or 'time'" });
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
      basis === "time" ? (interval_unit || null) : null,
      basis === "time" ? (interval_value || null) : null,
      last_performed_date || null,
    ]);

    res.json(computeNextDue(result.rows[0]));
  } catch (err) {
    console.error("Plans POST /", err);
    res.status(500).json({ error: "Failed to create maintenance plan" });
  }
});

/* ── UPDATE plan ──────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const { name, basis, threshold_km, last_maintenance_km, interval_unit, interval_value, last_performed_date } = req.body;

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
        interval_unit || null, interval_value || null, last_performed_date || null, req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });
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
      "DELETE FROM vehicle_maintenance_types WHERE maint_type_id=$1 RETURNING maint_type_id",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Plan not found" });
    res.json({ deleted: result.rows[0].maint_type_id });
  } catch (err) {
    console.error("Plans DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

/* ── RECORD MAINTENANCE + advance plan cycle ──────────────── */
// POST /api/vehicle-plans/perform/:maint_type_id
// Body: { vehicle_id, odometer, remarks, maintenance_cost, performed_by }
router.post("/perform/:maint_type_id", async (req, res) => {
  try {
    const { vehicle_id, odometer, remarks, maintenance_cost, performed_by } = req.body;
    const id = req.params.maint_type_id;

    // Fetch plan
    const planRes = await pool.query(
      "SELECT * FROM vehicle_maintenance_types WHERE maint_type_id=$1",
      [id]
    );
    if (!planRes.rows.length) return res.status(404).json({ error: "Plan not found" });
    const plan = planRes.rows[0];

    const today = new Date().toISOString().slice(0, 10);

    // Insert maintenance record
    await pool.query(`
      INSERT INTO vehicle_maintenance
        (vehicle_id, service_type, maintenance_date, maintenance_cost, odometer, remarks, performed_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [vehicle_id, plan.name, today, maintenance_cost || null, odometer || null, remarks || null, performed_by || null]);

    // Advance odometer plan: baseline = the ACTUAL odometer reported at
    // time of maintenance (may legitimately be lower than the vehicle's
    // current live odometer for retroactive entries).
    if (plan.basis === "odometer" && odometer) {
      const enteredOdo = parseInt(odometer);

      await pool.query(
        "UPDATE vehicle_maintenance_types SET last_maintenance_km=$1, last_performed_date=$2 WHERE maint_type_id=$3",
        [enteredOdo, today, id]
      );

      // ✅ FIX: vehicle's live odometer must never move backward.
      // GREATEST() means the vehicle only advances if the entered
      // value is higher than what's already stored; a lower,
      // retroactive maintenance entry updates the PLAN baseline only.
      await pool.query(
        `UPDATE vehicle
         SET odometer = GREATEST(odometer, $1),
             last_maintenance_km = GREATEST(last_maintenance_km, $1)
         WHERE vehicle_id = $2`,
        [enteredOdo, vehicle_id]
      );
    }

    // Advance time plan: record performed date so interval resets from today
    if (plan.basis === "time") {
      await pool.query(
        "UPDATE vehicle_maintenance_types SET last_performed_date=$1 WHERE maint_type_id=$2",
        [today, id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Plans POST /perform", err);
    res.status(500).json({ error: "Failed to record maintenance" });
  }
});

/* ── Helper: add a calendar interval, clamped to the target
   month's actual last day. Handles month-length differences
   and leap years automatically because new Date(y, m+1, 0)
   always resolves to the last real day of month m. ────────── */
function addIntervalClamped(dateStr, unit, value) {
  const d   = new Date(dateStr + "T00:00:00");
  const day = d.getDate();

  if (unit === "week") {
    const target = new Date(d);
    target.setDate(target.getDate() + value * 7);
    return target;
  }

  let target;
  if (unit === "year") {
    target = new Date(d.getFullYear() + value, d.getMonth(), 1);
  } else {
    // default: month
    target = new Date(d.getFullYear(), d.getMonth() + value, 1);
  }

  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDayOfTargetMonth));
  return target;
}

/* ── Helper: whole-day difference between two dates, both
   normalized to midnight so "today" comparisons are exact. ── */
function daysBetween(dateA, dateB) {
  const a = new Date(dateA); a.setHours(0, 0, 0, 0);
  const b = new Date(dateB); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

/* ── Helper: compute next_due and status for a plan ──────── */
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
      const next = addIntervalClamped(
        p.last_performed_date,
        p.interval_unit,
        parseInt(p.interval_value || 1)
      );
      p.next_due_date = next.toISOString().slice(0, 10);

      const daysLeft = daysBetween(next, new Date());
      p.days_left = daysLeft;

      if (daysLeft < 0)        p.status_computed = "overdue";
      else if (daysLeft === 0) p.status_computed = "due_today";
      else if (daysLeft <= 7)  p.status_computed = "due_soon";
      else                     p.status_computed = "ok";
    }
  }

  return p;
}

module.exports = router;