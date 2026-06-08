const express = require('express');
const router = express.Router();
const pool = require('../db'); // adjust if different

// ✅ GET ALL VEHICLES
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vehicle ORDER BY vehicle_id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching vehicles');
  }
});

// ✅ ADD VEHICLE
router.post('/', async (req, res) => {
  try {
    const {
      vehicle_name,
      plate_number,
      type,
      purchase_date,
      status,
      price,
      remarks
    } = req.body;

    await pool.query(
      `INSERT INTO vehicle 
       (vehicle_name, plate_number, type, purchase_date, status, price, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [vehicle_name, plate_number, type, purchase_date, status, price, remarks]
    );

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving vehicle');
  }
});

module.exports = router;
