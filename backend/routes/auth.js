const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user || user.password !== password) {
      return res.json({ error: "Invalid email or password" });
    }

    res.json({
      user: {
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        department: user.department
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
