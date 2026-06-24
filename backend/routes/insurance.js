// backend/routes/insurance.js
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

// GET ONE
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM insurance WHERE insurance_id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).send('Error');
  }
});

// CREATE
router.post('/', async (req, res) => {
  try {
    const { employee_name, provider, policy_number, start_date, expiry_date, remarks } = req.body;

    const result = await pool.query(
      `INSERT INTO insurance
       (employee_name, provider, policy_number, start_date, expiry_date, remarks)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [employee_name, provider, policy_number || null,
       start_date || null, expiry_date || null, remarks || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating insurance record');
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  try {
    const { employee_name, provider, policy_number, start_date, expiry_date, remarks } = req.body;

    await pool.query(
      `UPDATE insurance SET
        employee_name=$1, provider=$2, policy_number=$3,
        start_date=$4, expiry_date=$5, remarks=$6
       WHERE insurance_id=$7`,
      [employee_name, provider, policy_number || null,
       start_date || null, expiry_date || null, remarks || null,
       req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating insurance');
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM insurance WHERE insurance_id = $1',
      [req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Error deleting insurance');
  }
});

module.exports = router;
