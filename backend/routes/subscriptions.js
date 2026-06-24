// backend/routes/subscriptions.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET ALL
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions ORDER BY subscription_id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching subscriptions');
  }
});

// GET ONE
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE subscription_id = $1',
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
    const {
      category, assigned_to, account_identifier,
      plan_type, monthly_cost, start_date, expiry_date,
      status, remarks
    } = req.body;

    const result = await pool.query(
      `INSERT INTO subscriptions
       (category, assigned_to, account_identifier, plan_type,
        monthly_cost, start_date, expiry_date, status, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [category, assigned_to, account_identifier, plan_type,
       monthly_cost || null, start_date || null, expiry_date || null,
       status || 'Active', remarks || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating subscription');
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  try {
    const {
      category, assigned_to, account_identifier,
      plan_type, monthly_cost, start_date, expiry_date,
      status, remarks
    } = req.body;

    await pool.query(
      `UPDATE subscriptions SET
        category=$1, assigned_to=$2, account_identifier=$3,
        plan_type=$4, monthly_cost=$5, start_date=$6,
        expiry_date=$7, status=$8, remarks=$9
       WHERE subscription_id=$10`,
      [category, assigned_to, account_identifier, plan_type,
       monthly_cost || null, start_date || null, expiry_date || null,
       status || 'Active', remarks || null,
       req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating subscription');
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM subscriptions WHERE subscription_id = $1',
      [req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Error deleting subscription');
  }
});

module.exports = router;
