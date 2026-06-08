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

router.post("/maintenance", async (req, res) => {
  const {
    vehicle_id,
    service_type,
    maintenance_date,
    maintenance_cost,
    odometer,
    remarks
  } = req.body;

  // ✅ insert maintenance record
  await pool.query(
    `INSERT INTO vehicle_maintenance 
    (vehicle_id, service_type, maintenance_date, maintenance_cost, odometer, remarks)
    VALUES ($1,$2,$3,$4,$5,$6)`,
    [vehicle_id, service_type, maintenance_date, maintenance_cost, odometer, remarks]
  );

  // ✅ update vehicle current KM
  await pool.query(
    `UPDATE vehicle SET odometer = $1 WHERE vehicle_id = $2`,
    [odometer, vehicle_id]
  );

  res.sendStatus(200);
});

module.exports = router;
