const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ CREATE MAINTENANCE
const { logItemHistory } = require("../utils/itemHistory"); // add

router.post("/", async (req, res) => {
  const { laptop_id, check_date, condition, remarks, user_id } = req.body;

  await pool.query(`
    INSERT INTO laptop_maintenance (laptop_id, check_date, condition, remarks, user_id)
    VALUES ($1,$2,$3,$4,$5)
  `, [laptop_id, check_date, condition, remarks, user_id]);

  const lpRes = await pool.query("SELECT asset_number, serial_number FROM laptop WHERE laptop_id=$1", [laptop_id]);
  const lp = lpRes.rows[0];

  await logItemHistory({
    module: "laptop",
    record_id: laptop_id,
    action: "MAINTENANCE_PERFORMED",
    remarks: `Technical check: ${condition}${remarks ? " — " + remarks : ""}${lp ? ` (SN: ${lp.serial_number})` : ""}`,
    performed_by_id: user_id || null,
  });

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