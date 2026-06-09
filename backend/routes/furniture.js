const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET ALL
router.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT f.*, l.location_name
    FROM office_furniture f
    LEFT JOIN location l ON f.current_location = l.location_id
    ORDER BY f.office_furniture_id DESC
  `);

  res.json(result.rows);
});

// ✅ CREATE
router.post("/", async (req, res) => {
  const {
    furniture_name,
    quantity,
    date_of_purchase,
    price,
    remarks,
    current_location
  } = req.body;

  await pool.query(`
    INSERT INTO office_furniture
    (furniture_name, quantity, date_of_purchase, price, remarks, current_location)
    VALUES ($1,$2,$3,$4,$5,$6)
  `, [
    furniture_name,
    quantity,
    date_of_purchase,
    price,
    remarks,
    current_location
  ]);

  res.sendStatus(200);
});

// ✅ DELETE
router.delete("/:id", async (req, res) => {
  await pool.query(
    "DELETE FROM office_furniture WHERE office_furniture_id = $1",
    [req.params.id]
  );

  res.sendStatus(200);
});

// ✅ UPDATE (EDIT)
router.put("/:id", async (req, res) => {
  const {
    furniture_name,
    quantity,
    date_of_purchase,
    price,
    remarks,
    current_location
  } = req.body;

  await pool.query(`
    UPDATE office_furniture SET
      furniture_name=$1,
      quantity=$2,
      date_of_purchase=$3,
      price=$4,
      remarks=$5,
      current_location=$6
    WHERE office_furniture_id=$7
  `, [
    furniture_name,
    quantity,
    date_of_purchase,
    price,
    remarks,
    current_location,
    req.params.id
  ]);

  res.sendStatus(200);
});

module.exports = router;