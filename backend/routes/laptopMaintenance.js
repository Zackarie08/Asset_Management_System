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

router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        u.name AS technician_name
      FROM laptop_maintenance m
      LEFT JOIN users u ON m.user_id = u.user_id
      WHERE m.laptop_id = $1
      ORDER BY m.check_date DESC
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching maintenance");
  }
});

module.exports = router;