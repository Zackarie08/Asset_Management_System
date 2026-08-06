// ============================================================
// auth.js — Authentication & User Management
// Main History added (Global Item History rollout) — module "users".
// Password values are NEVER logged, only the fact that a reset/change occurred.
//
// ✅ NEW — Forced Default-Password Reset Flow:
//   Previously "Reset Password" let a Super Admin (or, due to a missing
//   role check, ANY logged-in user calling the endpoint directly) set an
//   arbitrary new password for someone else. That's a privacy problem —
//   the Super Admin would then know the employee's real password.
//
//   Now:
//   1. PUT /users/reset-password/:id — Super Admin ONLY (enforced here,
//      not just hidden in the UI). Ignores any password sent by the
//      client and always resets to DEFAULT_PASSWORD, then sets
//      must_change_password = true.
//   2. POST /login — returns must_change_password in the response so the
//      frontend can block the app and force the user to a "set your own
//      password" screen instead of the dashboard.
//   3. PUT /users/change-password/:id — the user sets their own new
//      password (must match their current password first, must be >=6
//      chars, cannot be the default password again). Clears the flag.
// ============================================================
const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { logItemHistory } = require("../utils/itemHistory");
const { isSuperAdmin } = require("../utils/roleCheck");

// ✅ NEW — shared default password used for every admin-triggered reset.
const DEFAULT_PASSWORD = "GPCCI@2026";

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
        // ✅ NEW — frontend must check this immediately after login and,
        // if true, block the app and show the forced password-change
        // screen instead of the dashboard.
        must_change_password: user.must_change_password === true,
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
      "SELECT user_id, name, email, role, department, must_change_password FROM users ORDER BY user_id DESC"
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

/* ── DELETE USER — Super Admin only ────────────────────────
   ✅ FIX: previously never checked the CALLER's role at all — only
   protected the TARGET from being super_admin. Any logged-in user could
   hit this endpoint directly. Now requires performer_id to resolve to
   super_admin. */
router.delete("/users/:id", async (req, res) => {
  try {
    const { performer_id } = req.query;
    if (!(await isSuperAdmin(performer_id))) {
      return res.status(403).send("Only Super Admin can delete users");
    }

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
    const { performed_by } = req.query;

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

/* ── RESET PASSWORD — Super Admin only, always resets to DEFAULT ──
   ✅ CHANGED: this route no longer accepts a password from the client
   at all — the whole point is that the Super Admin should never be able
   to set (and therefore know) someone's real password. It always resets
   to DEFAULT_PASSWORD and flags the account so the very next login is
   forced through the "set your own password" screen.
   Body: { performer_id, performed_by } */
router.put("/users/reset-password/:id", async (req, res) => {
  try {
    const { performer_id, performed_by } = req.body;

    if (!(await isSuperAdmin(performer_id))) {
      return res.status(403).json({ error: "Only Super Admin can reset passwords" });
    }

    const existing = await pool.query("SELECT name, email FROM users WHERE user_id=$1", [req.params.id]);
    if (!existing.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query(
      "UPDATE users SET password=$1, must_change_password=true WHERE user_id=$2",
      [DEFAULT_PASSWORD, req.params.id]
    );

    // ✅ Never log the password itself — only that a reset happened.
    await logItemHistory({
      module: "users",
      record_id: req.params.id,
      action: "EDITED",
      field_name: "password",
      remarks: "Password reset to default — user must set a new password on next login",
      performed_by_id: performer_id || null,
      performed_by_name: performed_by || null,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error resetting password");
  }
});

/* ── CHANGE PASSWORD (self) — after a forced default-password reset ──
   ✅ NEW: called ONLY by the user themselves, from the forced
   "set your own password" screen shown right after a default-password
   login. Requires the current (default) password to match, rejects
   reusing the default password as the new one, and clears the flag.
   Body: { current_password, new_password } */
router.put("/users/change-password/:id", async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    if (new_password === DEFAULT_PASSWORD) {
      return res.status(400).json({ error: "New password cannot be the default password" });
    }

    const existing = await pool.query("SELECT * FROM users WHERE user_id=$1", [req.params.id]);
    const user = existing.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.password !== current_password) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    await pool.query(
      "UPDATE users SET password=$1, must_change_password=false WHERE user_id=$2",
      [new_password, req.params.id]
    );

    await logItemHistory({
      module: "users",
      record_id: req.params.id,
      action: "EDITED",
      field_name: "password",
      remarks: "Password set by user after default-password reset",
      performed_by_id: user.user_id,
      performed_by_name: user.name,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error changing password");
  }
});

module.exports = router;