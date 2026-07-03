// backend/routes/insurance.js — AUDIT FIX PASS
// See Insurance_Module_Audit.md for the full investigation.
//
// Changes in this revision:
//   ✅ FIX #1 (root-cause candidate for "Edit doesn't work"):
//      insertEmployeeLink() previously used
//        INSERT ... ON CONFLICT DO NOTHING
//      "ON CONFLICT DO NOTHING" with no explicit conflict target
//      requires Postgres to find a matching UNIQUE or EXCLUSION
//      constraint on (insurance_id, user_id). If that constraint
//      was never added to insurance_employees (schema DDL wasn't
//      provided for this audit, so this couldn't be verified
//      directly), every save of a SPECIFIC-coverage record with
//      1+ employees throws:
//        "there is no unique or exclusion constraint matching the
//         ON CONFLICT specification"
//      which is caught by the route's try/catch and returned as a
//      generic 500. Because the OLD frontend only showed a generic
//      "Error saving record" toast, this would look exactly like
//      "Edit doesn't work" to a user, while GENERAL-coverage saves
//      (no employee insert) would work fine — matching the reported
//      symptom pattern. Replaced with an explicit existence check
//      that has no dependency on a unique constraint existing.
//   ✅ FIX #2: All routes now return JSON error bodies ({ error })
//      instead of plain-text .send(), consistent with contracts.js /
//      subscriptions.js / globe.js, so the frontend can display the
//      real failure reason instead of a generic message.
//   ✅ FIX #3: PUT /:id and DELETE /:id now 404 when the record
//      doesn't exist instead of silently succeeding.

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

/* ── helper: link an employee to an insurance record without
   depending on a DB-level unique constraint existing ───────── */
async function linkEmployeeIfMissing(insuranceId, userId) {
  const existing = await pool.query(
    'SELECT 1 FROM insurance_employees WHERE insurance_id=$1 AND user_id=$2',
    [insuranceId, userId]
  );
  if (existing.rows.length) return;
  await pool.query(
    'INSERT INTO insurance_employees (insurance_id, user_id) VALUES ($1,$2)',
    [insuranceId, userId]
  );
}

// GET ALL
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM insurance ORDER BY insurance_id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Insurance GET /', err);
    res.status(500).json({ error: 'Error fetching insurance records' });
  }
});

// GET ONE (with assigned employees)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM insurance WHERE insurance_id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.json(null);

    const ins = result.rows[0];

    // Fetch assigned employees if SPECIFIC coverage
    if (ins.coverage_type === 'SPECIFIC') {
      const empRes = await pool.query(`
        SELECT u.user_id, u.name, u.department
        FROM insurance_employees ie
        JOIN users u ON ie.user_id = u.user_id
        WHERE ie.insurance_id = $1
        ORDER BY u.name ASC
      `, [req.params.id]);
      ins.assigned_employees = empRes.rows;
    } else {
      ins.assigned_employees = [];
    }

    res.json(ins);
  } catch (err) {
    console.error('Insurance GET /:id', err);
    res.status(500).json({ error: 'Error fetching insurance record' });
  }
});

// CREATE
router.post('/', async (req, res) => {
  try {
    const {
      employee_name, provider, policy_number,
      start_date, expiry_date, remarks,
      coverage_type, employee_ids
    } = req.body;

    if (!employee_name || !provider) {
      return res.status(400).json({ error: 'employee_name and provider are required' });
    }

    const coverage = coverage_type || 'GENERAL';

    if (coverage === 'SPECIFIC' && (!Array.isArray(employee_ids) || employee_ids.length === 0)) {
      return res.status(400).json({ error: 'At least one employee is required for SPECIFIC coverage' });
    }

    const result = await pool.query(
      `INSERT INTO insurance
       (employee_name, provider, policy_number, start_date, expiry_date, remarks, coverage_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        employee_name, provider, policy_number || null,
        start_date || null, expiry_date || null,
        remarks || null, coverage
      ]
    );

    const ins = result.rows[0];

    // ✅ FIX #1: existence-check insert instead of ON CONFLICT DO NOTHING
    if (coverage === 'SPECIFIC' && Array.isArray(employee_ids) && employee_ids.length > 0) {
      for (const uid of employee_ids) {
        await linkEmployeeIfMissing(ins.insurance_id, uid);
      }
    }

    res.json(ins);
  } catch (err) {
    console.error('Insurance POST /', err);
    res.status(500).json({ error: 'Error creating insurance record' });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  try {
    const {
      employee_name, provider, policy_number,
      start_date, expiry_date, remarks,
      coverage_type, employee_ids
    } = req.body;

    if (!employee_name || !provider) {
      return res.status(400).json({ error: 'employee_name and provider are required' });
    }

    const coverage = coverage_type || 'GENERAL';

    if (coverage === 'SPECIFIC' && (!Array.isArray(employee_ids) || employee_ids.length === 0)) {
      return res.status(400).json({ error: 'At least one employee is required for SPECIFIC coverage' });
    }

    // ✅ FIX #3: 404 instead of silently "succeeding" on a missing id
    const existing = await pool.query(
      'SELECT insurance_id FROM insurance WHERE insurance_id=$1',
      [req.params.id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Insurance record not found' });
    }

    await pool.query(
      `UPDATE insurance SET
        employee_name=$1, provider=$2, policy_number=$3,
        start_date=$4, expiry_date=$5, remarks=$6, coverage_type=$7
       WHERE insurance_id=$8`,
      [
        employee_name, provider, policy_number || null,
        start_date || null, expiry_date || null,
        remarks || null, coverage,
        req.params.id
      ]
    );

    // Refresh employee assignments
    await pool.query(
      'DELETE FROM insurance_employees WHERE insurance_id=$1',
      [req.params.id]
    );

    // ✅ FIX #1: existence-check insert instead of ON CONFLICT DO NOTHING
    if (coverage === 'SPECIFIC' && Array.isArray(employee_ids) && employee_ids.length > 0) {
      for (const uid of employee_ids) {
        await linkEmployeeIfMissing(req.params.id, uid);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Insurance PUT /:id', err);
    res.status(500).json({ error: 'Error updating insurance record' });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    // Cascade: delete employee assignments first
    await pool.query(
      'DELETE FROM insurance_employees WHERE insurance_id=$1',
      [req.params.id]
    );
    const result = await pool.query(
      'DELETE FROM insurance WHERE insurance_id=$1 RETURNING insurance_id',
      [req.params.id]
    );

    // ✅ FIX #3
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Insurance record not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Insurance DELETE /:id', err);
    res.status(500).json({ error: 'Error deleting insurance record' });
  }
});

// GET employees assigned to a specific insurance
router.get('/:id/employees', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.user_id, u.name, u.department, u.role
      FROM insurance_employees ie
      JOIN users u ON ie.user_id = u.user_id
      WHERE ie.insurance_id = $1
      ORDER BY u.name ASC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Insurance GET /:id/employees', err);
    res.status(500).json({ error: 'Error fetching assigned employees' });
  }
});

module.exports = router;