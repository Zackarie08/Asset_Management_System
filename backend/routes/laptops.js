// ============================================================
// laptops.js — Laptop management
// AUDIT PASS (this revision):
//   ✅ NEW: `remarks` and `supplier` columns supported end-to-end
//      (create, edit, list, detail). See
//      backend/migrations/002_laptop_add_remarks_supplier.sql
//   ✅ FIX: PUT /assign/:id now explicitly normalizes an empty
//      string / undefined current_user_id to NULL so "Remove
//      Current User" (unassign) reliably clears the assignment
//      instead of accidentally writing "" into an integer FK
//      column (which some drivers/queries would reject or coerce
//      unpredictably). Assignment HISTORY is still always written,
//      including the unassign event (new_user_id = NULL), so the
//      audit trail is never lost.
//   (Older fix retained) Two router.put("/:id") handlers existed.
//      Express only executes the FIRST match, so the "edit laptop"
//      handler was silently ignored. Fixed by splitting into
//      PUT /assign/:id (assignment only) and PUT /:id (full edit).
// ============================================================
const express = require("express");
const router  = express.Router();
const pool    = require("../db");

/* ── GET ALL ────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*,
             u.name AS user_name,
             u.role AS user_role
      FROM laptop l
      LEFT JOIN users u ON l.current_user_id = u.user_id
      ORDER BY l.laptop_id DESC
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
      remarks, supplier                       // ✅ NEW FIELDS
    } = req.body;

    await pool.query(`
      INSERT INTO laptop (
        asset_number, item_description, serial_number, category,
        price, current_user_id, current_location, status,
        warranty_end_date, date_of_purchase, remarks, supplier
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, [
      asset_number, item_description, serial_number, category,
      price, current_user_id || null, current_location, status,
      warranty_end_date || null, date_of_purchase,
      remarks || null, supplier || null
    ]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating laptop");
  }
});

/* ── DELETE ─────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM laptop WHERE laptop_id=$1", [req.params.id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting laptop");
  }
});

/* ── ASSIGN / UNASSIGN USER — PUT /assign/:id ───────────── */
// Body: { current_user_id: <id> }  → assign
// Body: { current_user_id: null }  → unassign / return to pool
// ✅ FIX: normalize "" / undefined to NULL so unassign works cleanly
// and the assignment_history row correctly records new_user_id = NULL.
router.put("/assign/:id", async (req, res) => {
  try {
    const rawId = req.body.current_user_id;
    const current_user_id = (rawId === "" || rawId === undefined) ? null : rawId;

    // Save previous user for history
    const old = await pool.query(
      "SELECT current_user_id FROM laptop WHERE laptop_id=$1",
      [req.params.id]
    );
    const previous_user = old.rows[0]?.current_user_id;

    await pool.query(
      "UPDATE laptop SET current_user_id=$1 WHERE laptop_id=$2",
      [current_user_id, req.params.id]
    );

    // Log assignment history (unassign events are recorded too,
    // with new_user_id = NULL, so the trail is never lost)
    await pool.query(`
      INSERT INTO laptop_history (laptop_id, previous_user_id, new_user_id, date_changed)
      VALUES ($1,$2,$3,NOW())
    `, [req.params.id, previous_user, current_user_id]);

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
      remarks, supplier                       // ✅ NEW FIELDS
    } = req.body;

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
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Edit failed");
  }
});

/* ── ASSIGNMENT HISTORY ─────────────────────────────────── */
router.get("/:id/history", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*,
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