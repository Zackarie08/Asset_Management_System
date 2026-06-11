const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET ALL
router.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT * FROM m365
    ORDER BY license_id DESC
  `);

  res.json(result.rows);
});


// ✅ CREATE
router.post("/", async (req, res) => {
  const {
    assigned_email,
    license_type,
    category,
    license_cost,
    start_date,
    expiry_date,
    renewal_date,
    status,
    remarks
  } = req.body;

  await pool.query(`
    INSERT INTO m365
    (assigned_email, license_type, category,
     license_cost, start_date, expiry_date,
     renewal_date, status, remarks)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [
    assigned_email,
    license_type,
    category,
    license_cost,
    start_date,
    expiry_date,
    renewal_date,
    status,
    remarks
  ]);

  res.sendStatus(200);
});


// ✅ UPDATE
router.put("/:id", async (req, res) => {
  const {
    assigned_email,
    license_type,
    category,
    license_cost,
    start_date,
    expiry_date,
    renewal_date,
    status,
    remarks
  } = req.body;

  await pool.query(`
    UPDATE m365 SET
      assigned_email=$1,
      license_type=$2,
      category=$3,
      license_cost=$4,
      start_date=$5,
      expiry_date=$6,
      renewal_date=$7,
      status=$8,
      remarks=$9
    WHERE license_id=$10
  `, [
    assigned_email,
    license_type,
    category,
    license_cost,
    start_date,
    expiry_date,
    renewal_date,
    status,
    remarks,
    req.params.id
  ]);

  res.sendStatus(200);
});


// ✅ DELETE
router.delete("/:id", async (req, res) => {
  await pool.query(
    "DELETE FROM m365 WHERE license_id=$1",
    [req.params.id]
  );

  res.sendStatus(200);
});

module.exports = router;