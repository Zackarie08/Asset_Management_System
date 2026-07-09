// backend/routes/insurance.js — CUSTOM COVERAGE UPDATE
// See Insurance_Custom_Coverage_Update.md
//
// Adds a third coverage_type: CUSTOM. When selected, coverage_target
// (free text, e.g. "Company Vehicles", "GPCCI Building") is required
// instead of an employee list. Requires migration
// 003_subscription_insurance_updates.sql (adds insurance.coverage_target).

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

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
    const result = await pool.query('SELECT * FROM insurance ORDER BY insurance_id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Insurance GET /', err);
    res.status(500).json({ error: 'Error fetching insurance records' });
  }
});

// GET ONE (with assigned employees)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM insurance WHERE insurance_id = $1', [req.params.id]);
    if (!result.rows.length) return res.json(null);

    const ins = result.rows[0];

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
      coverage_type, employee_ids, coverage_target, // ✅ NEW
    } = req.body;

    if (!employee_name || !provider) {
      return res.status(400).json({ error: 'employee_name and provider are required' });
    }

    const coverage = coverage_type || 'GENERAL';

    if (coverage === 'SPECIFIC' && (!Array.isArray(employee_ids) || employee_ids.length === 0)) {
      return res.status(400).json({ error: 'At least one employee is required for SPECIFIC coverage' });
    }
    // ✅ NEW: CUSTOM requires a coverage target description instead of employees
    if (coverage === 'CUSTOM' && !(coverage_target && coverage_target.trim())) {
      return res.status(400).json({ error: 'Coverage Target is required for CUSTOM coverage' });
    }

    const result = await pool.query(
      `INSERT INTO insurance
       (employee_name, provider, policy_number, start_date, expiry_date, remarks, coverage_type, coverage_target)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        employee_name, provider, policy_number || null,
        start_date || null, expiry_date || null,
        remarks || null, coverage,
        coverage === 'CUSTOM' ? coverage_target.trim() : null,
      ]
    );

    const ins = result.rows[0];

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
      coverage_type, employee_ids, coverage_target, // ✅ NEW
    } = req.body;

    if (!employee_name || !provider) {
      return res.status(400).json({ error: 'employee_name and provider are required' });
    }

    const coverage = coverage_type || 'GENERAL';

    if (coverage === 'SPECIFIC' && (!Array.isArray(employee_ids) || employee_ids.length === 0)) {
      return res.status(400).json({ error: 'At least one employee is required for SPECIFIC coverage' });
    }
    if (coverage === 'CUSTOM' && !(coverage_target && coverage_target.trim())) {
      return res.status(400).json({ error: 'Coverage Target is required for CUSTOM coverage' });
    }

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
        start_date=$4, expiry_date=$5, remarks=$6, coverage_type=$7, coverage_target=$8
       WHERE insurance_id=$9`,
      [
        employee_name, provider, policy_number || null,
        start_date || null, expiry_date || null,
        remarks || null, coverage,
        coverage === 'CUSTOM' ? coverage_target.trim() : null,
        req.params.id,
      ]
    );

    // Refresh employee assignments regardless of coverage type
    // (clears stale SPECIFIC assignments when switching to GENERAL/CUSTOM)
    await pool.query(
      'DELETE FROM insurance_employees WHERE insurance_id=$1',
      [req.params.id]
    );

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
    await pool.query('DELETE FROM insurance_employees WHERE insurance_id=$1', [req.params.id]);
    const result = await pool.query(
      'DELETE FROM insurance WHERE insurance_id=$1 RETURNING insurance_id',
      [req.params.id]
    );

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