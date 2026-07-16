// backend/routes/furniture.js — Main History + Part 6 (Supplier fields)
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

// ✅ GET ALL
router.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT f.*, l.location_name
    FROM office_furniture f
    LEFT JOIN location l ON f.current_location = l.location_id
    ORDER BY f.office_furniture_id DESC
  `);

  res.json(result.rows);
});

// ✅ CREATE
router.post("/", async (req, res) => {
  const {
    furniture_name, quantity, date_of_purchase, price, remarks,
    current_location, condition, user_id, performed_by,
    supplier, supplier_contact, // ✅ NEW (Part 6)
  } = req.body;

  const inserted = await pool.query(`
    INSERT INTO office_furniture
    (furniture_name, quantity, date_of_purchase, price, remarks, current_location, condition, supplier, supplier_contact)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING office_furniture_id
  `, [
    furniture_name, quantity, date_of_purchase, price, remarks,
    current_location, condition || 'Good', supplier || null, supplier_contact || null
  ]);

  await logItemHistory({
    module: "furniture",
    record_id: inserted.rows[0].office_furniture_id,
    action: "CREATED",
    remarks: `${furniture_name} · Qty ${quantity}${supplier ? ' · Supplier: ' + supplier : ''}`,
    performed_by_id: user_id || null,
    performed_by_name: performed_by || null,
  });

  res.sendStatus(200);
});

// ✅ DELETE
router.delete("/:id", async (req, res) => {
  const existing = await pool.query("SELECT furniture_name FROM office_furniture WHERE office_furniture_id=$1", [req.params.id]);

  await pool.query(
    "DELETE FROM office_furniture WHERE office_furniture_id = $1",
    [req.params.id]
  );

  await logItemHistory({
    module: "furniture",
    record_id: req.params.id,
    action: "DELETED",
    remarks: existing.rows[0]?.furniture_name || null,
  });

  res.sendStatus(200);
});

// ✅ UPDATE (EDIT)
router.put("/:id", async (req, res) => {
  const {
    furniture_name, quantity, date_of_purchase, price, remarks,
    current_location, condition, user_id, performed_by,
    supplier, supplier_contact, // ✅ NEW (Part 6)
  } = req.body;

  const before = await pool.query(`
    SELECT f.*, l.location_name FROM office_furniture f
    LEFT JOIN location l ON f.current_location = l.location_id
    WHERE f.office_furniture_id=$1
  `, [req.params.id]);
  const old = before.rows[0];

  let newLocationName = null;
  if (current_location) {
    const locRes = await pool.query("SELECT location_name FROM location WHERE location_id=$1", [current_location]);
    newLocationName = locRes.rows[0]?.location_name || null;
  }

  await pool.query(`
    UPDATE office_furniture SET
      furniture_name=$1,
      quantity=$2,
      date_of_purchase=$3,
      price=$4,
      remarks=$5,
      current_location=$6,
      condition=$7,
      supplier=$8,
      supplier_contact=$9
    WHERE office_furniture_id=$10
  `, [
    furniture_name, quantity, date_of_purchase, price, remarks,
    current_location, condition || 'Good', supplier || null, supplier_contact || null, req.params.id
  ]);

  if (old) {
    const fieldChecks = [
      ["furniture_name", old.furniture_name, furniture_name],
      ["quantity", old.quantity, quantity],
      ["condition", old.condition, condition],
      ["location", old.location_name, newLocationName], // ✅ name snapshot, not location_id
      ["supplier", old.supplier, supplier], // ✅ NEW (Part 6)
      ["supplier_contact", old.supplier_contact, supplier_contact], // ✅ NEW (Part 6)
    ];
    for (const [field, oldVal, newVal] of fieldChecks) {
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        await logItemHistory({
          module: "furniture",
          record_id: req.params.id,
          action: field === "condition" ? "STATUS_CHANGED" : "EDITED",
          field_name: field,
          old_value: oldVal,
          new_value: newVal,
          performed_by_id: user_id || null,
          performed_by_name: performed_by || null,
        });
      }
    }
  }

  res.sendStatus(200);
});

module.exports = router;