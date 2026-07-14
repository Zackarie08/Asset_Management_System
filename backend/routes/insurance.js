// backend/routes/insurance.js — Part 6 (select-all + history)
// See Insurance_Enhancements.md
//
// Changes:
//   - Wired into Global Item History (module "insurance"): CREATED, EDITED,
//     COVERAGE_CHANGED (coverage type switch, employees added/removed),
//     DELETED.
//   - Per History_Snapshot_Strategy.md: employee rosters are snapshotted as
//     NAMES at the moment of the change, never left as raw user_ids —
//     renaming/deleting an employee later cannot alter what the history
//     says was covered at that time.
//   - CUSTOM coverage_target retained from the prior pass.

const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { logItemHistory } = require('../utils/itemHistory');

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

async function namesForIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const res = await pool.query('SELECT name FROM users WHERE user_id = ANY($1::int[]) ORDER BY name', [ids]);
  return res.rows.map(r => r.name);
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
      coverage_type, employee_ids, coverage_target,
      user_id, performed_by,
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

    let employeeNames = [];
    if (coverage === 'SPECIFIC' && Array.isArray(employee_ids) && employee_ids.length > 0) {
      for (const uid of employee_ids) {
        await linkEmployeeIfMissing(ins.insurance_id, uid);
      }
      employeeNames = await namesForIds(employee_ids);
    }

    const scopeNote = coverage === 'SPECIFIC'
      ? (employeeNames.length ? `Covering: ${employeeNames.join(', ')}` : null)
      : coverage === 'CUSTOM'
        ? `Covering: ${coverage_target}`
        : 'Covering: all employees';

    await logItemHistory({
      module: 'insurance',
      record_id: ins.insurance_id,
      action: 'CREATED',
      remarks: [provider, coverage, scopeNote].filter(Boolean).join(' · '),
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

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
      coverage_type, employee_ids, coverage_target,
      user_id, performed_by,
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

    const existing = await pool.query('SELECT * FROM insurance WHERE insurance_id=$1', [req.params.id]);
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Insurance record not found' });
    }
    const old = existing.rows[0];

    // ✅ Snapshot the OLD employee roster (names) before it's overwritten —
    // per History_Snapshot_Strategy.md, never rely on resolving this later.
    let oldEmployeeNames = [];
    if (old.coverage_type === 'SPECIFIC') {
      const oldEmpRes = await pool.query(`
        SELECT u.name FROM insurance_employees ie
        JOIN users u ON ie.user_id = u.user_id
        WHERE ie.insurance_id = $1 ORDER BY u.name
      `, [req.params.id]);
      oldEmployeeNames = oldEmpRes.rows.map(r => r.name);
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

    await pool.query('DELETE FROM insurance_employees WHERE insurance_id=$1', [req.params.id]);

    let newEmployeeNames = [];
    if (coverage === 'SPECIFIC' && Array.isArray(employee_ids) && employee_ids.length > 0) {
      for (const uid of employee_ids) {
        await linkEmployeeIfMissing(req.params.id, uid);
      }
      newEmployeeNames = await namesForIds(employee_ids);
    }

    // ── Field-level diffs ──
    const fieldChecks = [
      ['employee_name', old.employee_name, employee_name],
      ['provider', old.provider, provider],
      ['policy_number', old.policy_number, policy_number],
      ['coverage_type', old.coverage_type, coverage],
      ['coverage_target', old.coverage_target, coverage === 'CUSTOM' ? coverage_target.trim() : null],
    ];
    for (const [field, oldVal, newVal] of fieldChecks) {
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        await logItemHistory({
          module: 'insurance',
          record_id: req.params.id,
          action: field === 'coverage_type' ? 'COVERAGE_CHANGED' : 'EDITED',
          field_name: field,
          old_value: oldVal,
          new_value: newVal,
          performed_by_id: user_id || null,
          performed_by_name: performed_by || null,
        });
      }
    }

    // ── Employee roster diff — snapshot names, never IDs ──
    const oldSet = new Set(oldEmployeeNames);
    const newSet = new Set(newEmployeeNames);
    const added   = newEmployeeNames.filter(n => !oldSet.has(n));
    const removed = oldEmployeeNames.filter(n => !newSet.has(n));

    if (added.length) {
      await logItemHistory({
        module: 'insurance',
        record_id: req.params.id,
        action: 'COVERAGE_CHANGED',
        field_name: 'employees_added',
        new_value: added.join(', '),
        performed_by_id: user_id || null,
        performed_by_name: performed_by || null,
      });
    }
    if (removed.length) {
      await logItemHistory({
        module: 'insurance',
        record_id: req.params.id,
        action: 'COVERAGE_CHANGED',
        field_name: 'employees_removed',
        old_value: removed.join(', '),
        performed_by_id: user_id || null,
        performed_by_name: performed_by || null,
      });
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
    const existing = await pool.query('SELECT employee_name, provider FROM insurance WHERE insurance_id=$1', [req.params.id]);

    await pool.query('DELETE FROM insurance_employees WHERE insurance_id=$1', [req.params.id]);
    const result = await pool.query(
      'DELETE FROM insurance WHERE insurance_id=$1 RETURNING insurance_id',
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Insurance record not found' });
    }

    await logItemHistory({
      module: 'insurance',
      record_id: req.params.id,
      action: 'DELETED',
      remarks: existing.rows[0] ? `${existing.rows[0].employee_name} · ${existing.rows[0].provider}` : null,
    });

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