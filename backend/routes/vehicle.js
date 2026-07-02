// backend/routes/vehicle.js
//
// FIX LOG (this revision):
//   • PUT /update-odo/:id now rejects odometer values lower than the
//     currently stored reading, and rejects non-numeric/negative input.
//   • POST /maintenance (legacy full-record endpoint) now advances the
//     vehicle odometer with GREATEST() instead of a raw overwrite, so
//     a retroactive/lower reading can never move it backward.
//   • PUT /complete-maint/:id validates the odometer input and uses
//     GREATEST() for the same reason.

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

// ✅ UPDATE VEHICLE
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

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
      `UPDATE vehicle SET
        vehicle_name = $1,
        plate_number = $2,
        type = $3,
        purchase_date = $4,
        status = $5,
        price = $6,
        remarks = $7,
        odometer = $8,
        last_maintenance_km = $9,
        maintenance_threshold = $10
      WHERE vehicle_id = $11`,
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
        maintenance_threshold,
        id
      ]
    );

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating vehicle");
  }
});

// ✅ ADD MAINTENANCE RECORD (legacy full-record endpoint)
router.post("/maintenance", async (req, res) => {
  const {
    vehicle_id,
    service_type,
    maintenance_date,
    maintenance_cost,
    odometer,
    remarks
  } = req.body;

  const enteredOdo = parseInt(odometer);
  if (isNaN(enteredOdo) || enteredOdo < 0) {
    return res.status(400).send("Invalid odometer value");
  }

  await pool.query(
    `INSERT INTO vehicle_maintenance
    (vehicle_id, service_type, maintenance_date, maintenance_cost, odometer, remarks)
    VALUES ($1,$2,$3,$4,$5,$6)`,
    [vehicle_id, service_type, maintenance_date, maintenance_cost, enteredOdo, remarks]
  );

  // ✅ FIX: never let a maintenance record move the vehicle's live
  // odometer backward — only advance if the entered value is higher.
  await pool.query(
    `UPDATE vehicle SET odometer = GREATEST(odometer, $1) WHERE vehicle_id = $2`,
    [enteredOdo, vehicle_id]
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

// ✅ COMPLETE MAINTENANCE
router.put("/complete-maint/:id", async (req, res) => {
  try {
    const enteredOdo = parseInt(req.body.odometer);
    if (isNaN(enteredOdo) || enteredOdo < 0) {
      return res.status(400).send("Invalid odometer value");
    }

    // ✅ FIX: GREATEST() so completing maintenance can never regress
    // the vehicle's live odometer, even if a lower value is entered.
    await pool.query(
      `UPDATE vehicle 
       SET status = 'ACTIVE',
           odometer = GREATEST(odometer, $1),
           last_maintenance_km = GREATEST(last_maintenance_km, $1)
       WHERE vehicle_id = $2`,
      [enteredOdo, req.params.id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error completing maintenance");
  }
});

// ✅ UPDATE ODOMETER (direct reading update — cannot go backward)
router.put("/update-odo/:id", async (req, res) => {
  try {
    const newOdo = parseInt(req.body.odometer);
    if (isNaN(newOdo) || newOdo < 0) {
      return res.status(400).send("Invalid odometer value");
    }

    const current = await pool.query(
      "SELECT odometer FROM vehicle WHERE vehicle_id = $1",
      [req.params.id]
    );
    if (!current.rows.length) {
      return res.status(404).send("Vehicle not found");
    }

    const currentOdo = current.rows[0].odometer || 0;
    // ✅ FIX: reject any value lower than the current stored reading
    if (newOdo < currentOdo) {
      return res.status(400).send(`Odometer cannot be lower than current reading (${currentOdo} km)`);
    }

    await pool.query(
      "UPDATE vehicle SET odometer = $1 WHERE vehicle_id = $2",
      [newOdo, req.params.id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating odometer");
  }
});

router.delete("/:id", async (req, res) => {
  await pool.query(
    "DELETE FROM vehicle WHERE vehicle_id = $1",
    [req.params.id]
  );
  res.sendStatus(200);
});

module.exports = router;