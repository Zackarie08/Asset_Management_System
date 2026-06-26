// ============================================================
// auth.js — Authentication & User Management
// BUG FIX: All routes were declared AFTER module.exports,
//           so Express never registered them. Fix: moved
//           module.exports to the very bottom.
// ============================================================
const express = require("express");
const router  = express.Router();
const pool    = require("../db");

/* ── LOGIN ──────────────────────────────────────────────── */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    // NOTE: passwords are currently plaintext — see QA_REPORT suggestion #6
    if (!user || user.password !== password) {
      return res.json({ error: "Invalid email or password" });
    }
    res.json({
      user: {
        user_id:    user.user_id,
        name:       user.name,
        role:       user.role,
        department: user.department,
        email:      user.email,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ── GET ALL USERS ──────────────────────────────────────── */
router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT user_id, name, email, role, department FROM users ORDER BY user_id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users");
  }
});

/* ── CREATE USER ────────────────────────────────────────── */
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

/* ── UPDATE USER ────────────────────────────────────────── */
router.put("/users/:id", async (req, res) => {
  try {
    const existing = await pool.query(
      "SELECT role FROM users WHERE user_id=$1",
      [req.params.id]
    );
    const isSuper = existing.rows[0]?.role === "super_admin";
    // Protect super_admin role from being changed
    if (isSuper && req.body.role !== "super_admin") {
      return res.status(403).send("Cannot modify super admin role");
    }
    await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, department=$4 WHERE user_id=$5`,
      [req.body.name, req.body.email, req.body.role, req.body.department, req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating user");
  }
});

/* ── DELETE USER ────────────────────────────────────────── */
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT role FROM users WHERE user_id=$1",
      [req.params.id]
    );
    if (user.rows[0]?.role === "super_admin") {
      return res.status(403).send("Cannot delete super admin");
    }
    await pool.query("DELETE FROM users WHERE user_id=$1", [req.params.id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting user");
  }
});

/* ── RESET PASSWORD ─────────────────────────────────────── */
router.put("/users/reset-password/:id", async (req, res) => {
  try {
    const { new_password } = req.body;
    await pool.query(
      "UPDATE users SET password=$1 WHERE user_id=$2",
      [new_password, req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error resetting password");
  }
});

// ✅ FIX: module.exports MUST be at the bottom so all routes are registered
module.exports = router;
