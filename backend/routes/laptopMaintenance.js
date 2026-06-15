const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ CREATE MAINTENANCE
router.post("/", async (req, res) => {
  const {
    laptop_id,
    check_date,
    condition,
    remarks,
    user_id
  } = req.body;

  await pool.query(`
    INSERT INTO laptop_maintenance (
      laptop_id, check_date, condition, remarks, user_id
    )
    VALUES ($1,$2,$3,$4,$5)
  `, [laptop_id, check_date, condition, remarks, user_id]);

  res.sendStatus(200);
});

module.exports = router;