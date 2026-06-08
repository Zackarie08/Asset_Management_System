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
      remarks,
      odometer,
      last_maintenance_km,
      maintenance_threshold
    } = req.body;

    await pool.query(
      `INSERT INTO vehicle 
      (vehicle_name, plate_number, type, purchase_date, status, price, remarks, odometer, last_maintenance_km, maintenance_threshold)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        vehicle_name,
        plate_number,
        type,
        purchase_date,
        status,
        price,
        remarks,
        odometer,
        last_maintenance_km,
        maintenance_threshold
      ]
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

  await pool.query(
    `INSERT INTO vehicle_maintenance
    (vehicle_id, service_type, maintenance_date, maintenance_cost, odometer, remarks)
    VALUES ($1,$2,$3,$4,$5,$6)`,
    [vehicle_id, service_type, maintenance_date, maintenance_cost, odometer, remarks]
  );

  await pool.query(
    `UPDATE vehicle SET odometer = $1 WHERE vehicle_id = $2`,
    [odometer, vehicle_id]
  );

  res.sendStatus(200);
});


router.get("/maintenance/:id", async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM vehicle_maintenance 
     WHERE vehicle_id = $1
     ORDER BY maintenance_date DESC`,
    [req.params.id]
  );

  res.json(result.rows);
});

router.put("/start-maint/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE vehicle SET status = 'UNDER_MAINTENANCE' WHERE vehicle_id = $1",
      [req.params.id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating status");
  }
});

router.put("/complete-maint/:id", async (req, res) => {
  try {
    const { odometer } = req.body;

    await pool.query(
      `UPDATE vehicle 
       SET status = 'ACTIVE',
           last_maintenance_km = $1
       WHERE vehicle_id = $2`,
      [odometer, req.params.id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error completing maintenance");
  }
});

router.put("/update-odo/:id", async (req, res) => {
  const { odometer } = req.body;

  await pool.query(
    "UPDATE vehicle SET odometer = $1 WHERE vehicle_id = $2",
    [odometer, req.params.id]
  );

  res.sendStatus(200);
});

router.delete("/:id", async (req, res) => {
  await pool.query(
    "DELETE FROM vehicle WHERE vehicle_id = $1",
    [req.params.id]
  );
  res.sendStatus(200);
});

module.exports = router;
