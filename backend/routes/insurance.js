// backend/routes/insurance.js — UPDATED
// Changes:
//   • coverage_type field: 'GENERAL' or 'SPECIFIC'
//   • insurance_employees linking table support
//   • GET /api/insurance/:id now includes assigned employees

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET ALL
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM insurance ORDER BY insurance_id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching insurance records');
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
    console.error(err);
    res.status(500).send('Error fetching insurance record');
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

    const coverage = coverage_type || 'GENERAL';

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

    // If SPECIFIC coverage, insert employee assignments
    if (coverage === 'SPECIFIC' && Array.isArray(employee_ids) && employee_ids.length > 0) {
      for (const uid of employee_ids) {
        await pool.query(
          'INSERT INTO insurance_employees (insurance_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [ins.insurance_id, uid]
        );
      }
    }

    res.json(ins);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating insurance record');
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

    const coverage = coverage_type || 'GENERAL';

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

    if (coverage === 'SPECIFIC' && Array.isArray(employee_ids) && employee_ids.length > 0) {
      for (const uid of employee_ids) {
        await pool.query(
          'INSERT INTO insurance_employees (insurance_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, uid]
        );
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating insurance');
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
    await pool.query(
      'DELETE FROM insurance WHERE insurance_id=$1',
      [req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting insurance');
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
    console.error(err);
    res.status(500).send('Error fetching assigned employees');
  }
});

module.exports = router;
