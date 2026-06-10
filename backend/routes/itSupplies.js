const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET ALL
router.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT it.*, l.location_name
    FROM it_supplies it
    LEFT JOIN location l ON it.location_id = l.location_id
    ORDER BY it.it_supplies_id DESC
  `);

  res.json(result.rows);
});


// ✅ CREATE
router.post("/", async (req, res) => {
  const {
    asset_name,
    serial_number,
    quantity,
    date_of_purchase,
    price,
    warranty_end_date,
    remarks,
    location_id,
    status
  } = req.body;

  await pool.query(`
    INSERT INTO it_supplies
    (asset_name, serial_number, quantity, date_of_purchase, price, warranty_end_date, remarks, location_id, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [
    asset_name,
    serial_number,
    quantity,
    date_of_purchase,
    price,
    warranty_end_date,
    remarks,
    location_id,
    status
  ]);

  res.sendStatus(200);
});


// ✅ UPDATE
router.put("/:id", async (req, res) => {
  const {
    asset_name,
    serial_number,
    quantity,
    date_of_purchase,
    price,
    warranty_end_date,
    remarks,
    location_id,
    status
  } = req.body;

  await pool.query(`
    UPDATE it_supplies SET
      asset_name=$1,
      serial_number=$2,
      quantity=$3,
      date_of_purchase=$4,
      price=$5,
      warranty_end_date=$6,
      remarks=$7,
      location_id=$8,
      status=$9
    WHERE it_supplies_id=$10
  `, [
    asset_name,
    serial_number,
    quantity,
    date_of_purchase,
    price,
    warranty_end_date,
    remarks,
    location_id,
    status,
    req.params.id
  ]);

  res.sendStatus(200);
});


// ✅ DELETE
router.delete("/:id", async (req, res) => {
  await pool.query(
    "DELETE FROM it_supplies WHERE it_supplies_id=$1",
    [req.params.id]
  );

  res.sendStatus(200);
});

module.exports = router;