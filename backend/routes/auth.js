// ============================================================
// auth.js — Authentication & User Management
// Main History added (Global Item History rollout) — module "users".
// Password values are NEVER logged, only the fact that a reset occurred.
// ============================================================
const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

/* ── LOGIN ──────────────────────────────────────────────── */
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
    const { name, email, password, role, department, performed_by, performer_id } = req.body;
    const inserted = await pool.query(
      "INSERT INTO users (name, email, password, role, department) VALUES ($1,$2,$3,$4,$5) RETURNING user_id",
      [name, email, password, role, department]
    );

    await logItemHistory({
      module: "users",
      record_id: inserted.rows[0].user_id,
      action: "CREATED",
      remarks: `${name} · ${email} · ${role}${department ? ' · ' + department : ''}`,
      performed_by_id: performer_id || null,
      performed_by_name: performed_by || null,
    });

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
      "SELECT * FROM users WHERE user_id=$1",
      [req.params.id]
    );
    const old = existing.rows[0];
    const isSuper = old?.role === "super_admin";
    if (isSuper && req.body.role !== "super_admin") {
      return res.status(403).send("Cannot modify super admin role");
    }

    const { performed_by, performer_id } = req.body;

    await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, department=$4 WHERE user_id=$5`,
      [req.body.name, req.body.email, req.body.role, req.body.department, req.params.id]
    );

    // ✅ Main history — field-level diffs, name/role snapshots (this IS
    // the snapshot source other modules borrow from — never re-resolve
    // this user's own history through a live self-join).
    if (old) {
      const fieldChecks = [
        ["name", old.name, req.body.name],
        ["email", old.email, req.body.email],
        ["role", old.role, req.body.role],
        ["department", old.department, req.body.department],
      ];
      for (const [field, oldVal, newVal] of fieldChecks) {
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          await logItemHistory({
            module: "users",
            record_id: req.params.id,
            action: field === "role" ? "STATUS_CHANGED" : "EDITED",
            field_name: field,
            old_value: oldVal,
            new_value: newVal,
            performed_by_id: performer_id || null,
            performed_by_name: performed_by || null,
          });
        }
      }
    }

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
      "SELECT name, email, role FROM users WHERE user_id=$1",
      [req.params.id]
    );
    if (user.rows[0]?.role === "super_admin") {
      return res.status(403).send("Cannot delete super admin");
    }
    await pool.query("DELETE FROM users WHERE user_id=$1", [req.params.id]);

    // DELETE requests carry no body — attribution comes via query string
    // (same convention already used by inventory.js's DELETE /:id).
    const { performer_id, performed_by } = req.query;

    await logItemHistory({
      module: "users",
      record_id: req.params.id,
      action: "DELETED",
      remarks: user.rows[0] ? `${user.rows[0].name} · ${user.rows[0].email}` : null,
      performed_by_id: performer_id || null,
      performed_by_name: performed_by || null,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting user");
  }
});

/* ── RESET PASSWORD ─────────────────────────────────────── */
router.put("/users/reset-password/:id", async (req, res) => {
  try {
    const { new_password, performed_by, performer_id } = req.body;
    await pool.query(
      "UPDATE users SET password=$1 WHERE user_id=$2",
      [new_password, req.params.id]
    );

    // ✅ Never log the password itself — only that a reset happened.
    await logItemHistory({
      module: "users",
      record_id: req.params.id,
      action: "EDITED",
      field_name: "password",
      remarks: "Password reset",
      performed_by_id: performer_id || null,
      performed_by_name: performed_by || null,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error resetting password");
  }
});

module.exports = router;