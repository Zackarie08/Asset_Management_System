const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET
router.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM laptop");
  res.json(result.rows);
});

// CREATE
router.post("/", async (req, res) => {
  const {
    asset_number,
    item_description,
    serial_number,
    category,
    price,
    current_user_id,
    current_location,
    status,
    warranty_end_date,
    date_of_purchase
  } = req.body;

  await pool.query(`
    INSERT INTO laptop (
      asset_number,
      item_description,
      serial_number,
      category,
      price,
      current_user_id,
      current_location,
      status,
      warranty_end_date,
      date_of_purchase
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [
    asset_number,
    item_description,
    serial_number,
    category,
    price,
    current_user_id,
    current_location,
    status,
    warranty_end_date,
    date_of_purchase
  ]);

  res.sendStatus(200);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await pool.query(
    "DELETE FROM laptop WHERE laptop_id=$1",
    [req.params.id]
  );

  res.sendStatus(200);
});

module.exports = router;