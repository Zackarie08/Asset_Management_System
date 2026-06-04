const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET ALL LOCATIONS
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM location ORDER BY location_name ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching locations");
  }
});

module.exports = router;
