const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND password = $2",
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    res.json({
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      department: user.department 
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Login error");
  }
});

module.exports = router;