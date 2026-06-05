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


router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users ORDER BY user_id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users");
  }
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;

    await pool.query(
      "INSERT INTO users (name, email, password, role, department) VALUES ($1,$2,$3,$4,$5)",
      [name, email, password, role, department]
    );

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving user");
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM users WHERE user_id = $1",
      [req.params.id]
    );

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting user");
  }
});