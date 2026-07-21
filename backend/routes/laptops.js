// ============================================================
// laptops.js — Laptop management
// IMMUTABILITY FIX PASS (this revision):
//   See Assignment_History_Protection.md for full detail.
//   - laptop_history now stores previous_user_name/role and
//     new_user_name/role SNAPSHOTS at the moment of assignment,
//     resolved once and never re-joined. GET /:id/history no
//     longer LEFT JOINs users — renaming or deleting a user can
//     no longer alter past assignment history.
//   - Also wired into the Global Item History table (item_history,
//     module "laptop") on create/edit/assign/unassign/delete, using
//     the same snapshot values, per Global_Item_History_Architecture.md.
//
// (Prior fixes retained below, unchanged: remarks/supplier columns,
// PUT /assign vs PUT /:id split, "" -> NULL normalization on unassign.)
// ============================================================
const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { logItemHistory } = require("../utils/itemHistory");
const { numChanged } = require("../utils/itemHistory"); 

/* ── GET ALL ────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*,
             u.name AS user_name,
             u.role AS user_role,
             loc.location_name AS location_name
      FROM laptop l
      LEFT JOIN users u ON l.current_user_id = u.user_id
      LEFT JOIN location loc ON l.current_location = loc.location_id
      ORDER BY l.asset_number ASC   
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching laptops");
  }
});

/* ── CREATE ─────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      asset_number, item_description, serial_number,
      category, price, current_user_id, current_location,
      status, warranty_end_date, date_of_purchase,
      remarks, supplier
    } = req.body;

    const inserted = await pool.query(`
      INSERT INTO laptop (
        asset_number, item_description, serial_number, category,
        price, current_user_id, current_location, status,
        warranty_end_date, date_of_purchase, remarks, supplier
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING laptop_id
    `, [
      asset_number, item_description, serial_number, category,
      price, current_user_id || null, current_location, status,
      warranty_end_date || null, date_of_purchase,
      remarks || null, supplier || null
    ]);

    await logItemHistory({
      module: "laptop",
      record_id: inserted.rows[0].laptop_id,
      action: "CREATED",
      remarks: `${asset_number} · ${serial_number}`,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating laptop");
  }
});

/* ── DELETE ─────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const existing = await pool.query(
      "SELECT asset_number, serial_number FROM laptop WHERE laptop_id=$1",
      [req.params.id]
    );
    const lp = existing.rows[0];

    await pool.query("DELETE FROM laptop WHERE laptop_id=$1", [req.params.id]);

    await logItemHistory({
      module: "laptop",
      record_id: req.params.id,
      action: "DELETED",
      remarks: lp ? `${lp.asset_number} · ${lp.serial_number}` : null,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting laptop");
  }
});

/* ── ASSIGN / UNASSIGN USER — PUT /assign/:id ───────────── */
// Body: { current_user_id: <id>, user_id, performed_by } → assign
// Body: { current_user_id: null, user_id, performed_by }  → unassign
router.put("/assign/:id", async (req, res) => {
  try {
    const rawId = req.body.current_user_id;
    const current_user_id = (rawId === "" || rawId === undefined) ? null : rawId;
    const { user_id, performed_by } = req.body;

    const old = await pool.query(
      "SELECT current_user_id FROM laptop WHERE laptop_id=$1",
      [req.params.id]
    );
    const previous_user = old.rows[0]?.current_user_id;

    // ✅ IMMUTABILITY FIX: resolve both names/roles NOW, at write time.
    // These are stored as permanent snapshots — a later rename or deletion
    // of either user can never alter this history row again.
    const [prevUserRes, newUserRes] = await Promise.all([
      previous_user
        ? pool.query("SELECT name, role FROM users WHERE user_id=$1", [previous_user])
        : Promise.resolve({ rows: [] }),
      current_user_id
        ? pool.query("SELECT name, role FROM users WHERE user_id=$1", [current_user_id])
        : Promise.resolve({ rows: [] }),
    ]);
    const previous_user_name = prevUserRes.rows[0]?.name || null;
    const previous_user_role = prevUserRes.rows[0]?.role || null;
    const new_user_name      = newUserRes.rows[0]?.name  || null;
    const new_user_role      = newUserRes.rows[0]?.role  || null;

    await pool.query(
      "UPDATE laptop SET current_user_id=$1 WHERE laptop_id=$2",
      [current_user_id, req.params.id]
    );

    // Assignment history — snapshot columns now, live IDs kept only for
    // internal reference (never used to resolve display names again).
    await pool.query(`
      INSERT INTO laptop_history
        (laptop_id, previous_user_id, new_user_id, date_changed,
         previous_user_name, previous_user_role, new_user_name, new_user_role)
      VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7)
    `, [
      req.params.id, previous_user, current_user_id,
      previous_user_name, previous_user_role, new_user_name, new_user_role
    ]);

    // Global Item History — same snapshot values, no re-resolution.
    await logItemHistory({
      module: "laptop",
      record_id: req.params.id,
      action: current_user_id ? "ASSIGNED" : "UNASSIGNED",
      field_name: "current_user",
      old_value: previous_user_name,
      new_value: new_user_name,
      performed_by_id: user_id,
      performed_by_name: performed_by,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Assign failed");
  }
});

/* ── FULL EDIT — PUT /:id ───────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const {
      asset_number, item_description, serial_number,
      category, price, current_location, status,
      warranty_end_date, date_of_purchase,
      remarks, supplier, user_id, performed_by
    } = req.body;

    const before = await pool.query("SELECT * FROM laptop WHERE laptop_id=$1", [req.params.id]);
    const old = before.rows[0];

    await pool.query(`
      UPDATE laptop SET
        asset_number      = $1,
        item_description  = $2,
        serial_number     = $3,
        category          = $4,
        price             = $5,
        current_location  = $6,
        status            = $7,
        warranty_end_date = $8,
        date_of_purchase  = $9,
        remarks           = $10,
        supplier          = $11
      WHERE laptop_id = $12
    `, [
      asset_number, item_description, serial_number,
      category, price, current_location, status,
      warranty_end_date || null, date_of_purchase,
      remarks || null, supplier || null,
      req.params.id
    ]);

    if (old) {

      // replace fieldChecks loop body for price with:
      const fieldChecks = [
        ["asset_number", old.asset_number, asset_number, false],
        ["serial_number", old.serial_number, serial_number, false],
        ["category", old.category, category, false],
        ["status", old.status, status, false],
        ["price", old.price, price, true], // ✅ numeric flag
      ];
      for (const [field, oldVal, newVal, isNum] of fieldChecks) {
        const changed = isNum ? numChanged(oldVal, newVal) : String(oldVal ?? '') !== String(newVal ?? '');
        if (changed) {
          await logItemHistory({ module: "laptop", record_id: req.params.id, action: "EDITED",
            field_name: field, old_value: oldVal, new_value: newVal,
            performed_by_id: user_id, performed_by_name: performed_by });
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Edit failed");
  }
});

/* ── ASSIGNMENT HISTORY ─────────────────────────────────── */
// ✅ IMMUTABILITY FIX: no longer joins `users`. Snapshot columns are the
// source of truth; rows written before migration 006 (snapshot columns
// NULL) fall back to a clearly-labeled placeholder, never to a live join.
router.get("/:id/history", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        h.history_id, h.laptop_id, h.previous_user_id, h.new_user_id, h.date_changed,
        CASE
          WHEN h.previous_user_id IS NULL THEN 'Unassigned'
          WHEN h.previous_user_name IS NULL THEN '(unknown — recorded before snapshot upgrade)'
          ELSE h.previous_user_name
        END AS previous_user_name,
        CASE
          WHEN h.new_user_id IS NULL THEN 'Unassigned'
          WHEN h.new_user_name IS NULL THEN '(unknown — recorded before snapshot upgrade)'
          ELSE h.new_user_name
        END AS new_user_name,
        h.previous_user_role, h.new_user_role
      FROM laptop_history h
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