const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET
router.get("/", async (req, res) => {
  const result = await pool.query("SELECT l.*, u.name AS user_name FROM laptop l LEFT JOIN users u ON l.current_user_id = u.user_id ORDER BY l.laptop_id DESC");
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

// ✅ UPDATE LAPTOP (ASSIGN USER)
router.put("/:id", async (req, res) => {
  const { current_user_id } = req.body;

  try {
    // ✅ get previous user
    const old = await pool.query(
      "SELECT current_user_id FROM laptop WHERE laptop_id=$1",
      [req.params.id]
    );

    const previous_user = old.rows[0].current_user_id;

    // ✅ update laptop
    await pool.query(
      "UPDATE laptop SET current_user_id=$1 WHERE laptop_id=$2",
      [current_user_id, req.params.id]
    );

    // ✅ save history
    await pool.query(`
      INSERT INTO laptop_history (
        laptop_id,
        previous_user_id,
        new_user_id,
        date_changed
      ) VALUES ($1,$2,$3,NOW())
    `, [
      req.params.id,
      previous_user,
      current_user_id
    ]);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Update failed");
  }
});

// ✅ GET LAPTOP HISTORY
router.get("/:id/history", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        h.*,
        u1.name AS previous_user_name,
        u2.name AS new_user_name
      FROM laptop_history h
      LEFT JOIN users u1 ON h.previous_user_id = u1.user_id
      LEFT JOIN users u2 ON h.new_user_id = u2.user_id
      WHERE h.laptop_id = $1
      ORDER BY h.date_changed DESC
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching history");
  }
});

module.exports = router;