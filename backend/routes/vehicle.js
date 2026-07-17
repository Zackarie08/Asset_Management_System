// backend/routes/vehicle.js — Main History added
// Maintenance-specific detail records stay in vehicle_maintenance /
// vehicle_maintenance_types (shown as the separate "Maintenance History"
// DP section) — this file's hooks cover the VEHICLE RECORD's own
// lifecycle (created/edited/status changes/deleted), which is the
// "main history," distinct from that maintenance detail list.
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logItemHistory } = require('../utils/itemHistory');
const { numChanged } = require("../utils/itemHistory"); 

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
      vehicle_name, plate_number, type, purchase_date, status, price,
      remarks, odometer, last_maintenance_km, maintenance_threshold,
      user_id, performed_by,
    } = req.body;

    const inserted = await pool.query(
      `INSERT INTO vehicle 
      (vehicle_name, plate_number, type, purchase_date, status, price, remarks, odometer, last_maintenance_km, maintenance_threshold)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING vehicle_id`,
      [
        vehicle_name, plate_number, type, purchase_date, status, price,
        remarks, odometer, last_maintenance_km, maintenance_threshold
      ]
    );

    await logItemHistory({
      module: 'vehicle',
      record_id: inserted.rows[0].vehicle_id,
      action: 'CREATED',
      remarks: `${vehicle_name} · ${plate_number}`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

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
      vehicle_name, plate_number, type, purchase_date, status, price,
      remarks, odometer, last_maintenance_km, maintenance_threshold,
      user_id, performed_by,
    } = req.body;

    const before = await pool.query('SELECT * FROM vehicle WHERE vehicle_id=$1', [id]);
    const old = before.rows[0];

    await pool.query(
      `UPDATE vehicle SET
        vehicle_name = $1, plate_number = $2, type = $3, purchase_date = $4,
        status = $5, price = $6, remarks = $7, odometer = $8,
        last_maintenance_km = $9, maintenance_threshold = $10
      WHERE vehicle_id = $11`,
      [
        vehicle_name, plate_number, type, purchase_date, status, price,
        remarks, odometer, last_maintenance_km, maintenance_threshold, id
      ]
    );

    if (old) {
      const fieldChecks = [
        ["vehicle_name", old.vehicle_name, vehicle_name, false],
        ["plate_number", old.plate_number, plate_number, false],
        ["type", old.type, type, false],
        ["status", old.status, status, false],
        ["price", old.price, price, true],
      ];

      for (const [field, oldVal, newVal, isNum] of fieldChecks) {
        const changed = isNum
          ? numChanged(oldVal, newVal)
          : String(oldVal ?? '') !== String(newVal ?? '');

        if (changed) {
          await logItemHistory({
            module: 'vehicle',
            record_id: id,
            action: field === 'status' ? 'STATUS_CHANGED' : 'EDITED',
            field_name: field,
            old_value: oldVal,
            new_value: newVal,
            performed_by_id: user_id || null,
            performed_by_name: performed_by || null,
          });
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating vehicle");
  }
});

router.post("/maintenance", async (req, res) => {
  const { vehicle_id, service_type, maintenance_date, maintenance_cost, odometer, remarks, performed_by, user_id } = req.body;

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

  await logItemHistory({
    module: 'vehicle',
    record_id: vehicle_id,
    action: 'MAINTENANCE_PERFORMED',
    remarks: `${service_type} performed on ${maintenance_date}${remarks ? ' — ' + remarks : ''}`,
    performed_by_id: user_id || null,
    performed_by_name: performed_by || null,
  });

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
    const { performed_by, user_id } = req.body;

    await pool.query(
      "UPDATE vehicle SET status = 'UNDER_MAINTENANCE' WHERE vehicle_id = $1",
      [req.params.id]
    );

    await logItemHistory({
      module: 'vehicle',
      record_id: req.params.id,
      action: 'STATUS_CHANGED',
      field_name: 'status',
      new_value: 'UNDER_MAINTENANCE',
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating status");
  }
});

router.put("/complete-maint/:id", async (req, res) => {
  try {
    const { odometer, performed_by, user_id } = req.body;

    await pool.query(
      `UPDATE vehicle 
       SET status = 'ACTIVE',
           last_maintenance_km = $1
       WHERE vehicle_id = $2`,
      [odometer, req.params.id]
    );

    await logItemHistory({
      module: 'vehicle',
      record_id: req.params.id,
      action: 'STATUS_CHANGED',
      field_name: 'status',
      old_value: 'UNDER_MAINTENANCE',
      new_value: 'ACTIVE',
      remarks: `Maintenance completed at ${odometer} km`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error completing maintenance");
  }
});

router.put("/update-odo/:id", async (req, res) => {
  const { odometer, performed_by, user_id } = req.body;

  const before = await pool.query('SELECT odometer FROM vehicle WHERE vehicle_id=$1', [req.params.id]);
  const oldOdo = before.rows[0]?.odometer;

  await pool.query(
    "UPDATE vehicle SET odometer = $1 WHERE vehicle_id = $2",
    [odometer, req.params.id]
  );

  await logItemHistory({
    module: 'vehicle',
    record_id: req.params.id,
    action: 'EDITED',
    field_name: 'odometer',
    old_value: oldOdo,
    new_value: odometer,
    performed_by_id: user_id || null,
    performed_by_name: performed_by || null,
  });

  res.sendStatus(200);
});

router.delete("/:id", async (req, res) => {
  const existing = await pool.query('SELECT vehicle_name, plate_number FROM vehicle WHERE vehicle_id=$1', [req.params.id]);

  await pool.query(
    "DELETE FROM vehicle WHERE vehicle_id = $1",
    [req.params.id]
  );

  await logItemHistory({
    module: 'vehicle',
    record_id: req.params.id,
    action: 'DELETED',
    remarks: existing.rows[0] ? `${existing.rows[0].vehicle_name} · ${existing.rows[0].plate_number}` : null,
  });

  res.sendStatus(200);
});

module.exports = router;