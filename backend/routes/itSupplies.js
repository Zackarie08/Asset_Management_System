// backend/routes/itSupplies.js — Part 3 (item history) + Part 6 (Supplier fields) + Part 7 (Unit)
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

// ✅ GET ALL
router.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT it.*, l.location_name
    FROM it_supplies it
    LEFT JOIN location l ON it.location_id = l.location_id
    ORDER BY it.it_supplies_id DESC
  `);

  res.json(result.rows);
});


// ✅ CREATE
router.post("/", async (req, res) => {
  const {
    asset_name,
    serial_number,
    quantity,
    unit, // ✅ NEW (Part 7)
    date_of_purchase,
    price,
    warranty_end_date,
    remarks,
    location_id,
    status,
    user_id,
    performed_by,
    supplier, supplier_contact,
  } = req.body;

  const inserted = await pool.query(`
    INSERT INTO it_supplies
    (asset_name, serial_number, quantity, unit, date_of_purchase, price, warranty_end_date, remarks, location_id, status, supplier, supplier_contact)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING it_supplies_id
  `, [
    asset_name,
    serial_number,
    quantity,
    unit || 'Piece', // ✅ NEW (Part 7) — matches Inventory's default posture
    date_of_purchase,
    price,
    warranty_end_date,
    remarks,
    location_id,
    status,
    supplier || null,
    supplier_contact || null,
  ]);

  await logItemHistory({
    module: "itsupplies",
    record_id: inserted.rows[0].it_supplies_id,
    action: "CREATED",
    remarks: `${asset_name}${serial_number ? ' · ' + serial_number : ''}${unit ? ' · ' + quantity + ' ' + unit : ''}${supplier ? ' · Supplier: ' + supplier : ''}`,
    performed_by_id: user_id || null,
    performed_by_name: performed_by || null,
  });

  res.sendStatus(200);
});


// ✅ UPDATE
router.put("/:id", async (req, res) => {
  const {
    asset_name,
    serial_number,
    quantity,
    unit, // ✅ NEW (Part 7)
    date_of_purchase,
    price,
    warranty_end_date,
    remarks,
    location_id,
    status,
    user_id,
    performed_by,
    supplier, supplier_contact,
  } = req.body;

  const before = await pool.query("SELECT * FROM it_supplies WHERE it_supplies_id=$1", [req.params.id]);
  const old = before.rows[0];

  await pool.query(`
    UPDATE it_supplies SET
      asset_name=$1,
      serial_number=$2,
      quantity=$3,
      unit=$4,
      date_of_purchase=$5,
      price=$6,
      warranty_end_date=$7,
      remarks=$8,
      location_id=$9,
      status=$10,
      supplier=$11,
      supplier_contact=$12
    WHERE it_supplies_id=$13
  `, [
    asset_name,
    serial_number,
    quantity,
    unit || 'Piece',
    date_of_purchase,
    price,
    warranty_end_date,
    remarks,
    location_id,
    status,
    supplier || null,
    supplier_contact || null,
    req.params.id
  ]);

  if (old) {
    const fieldChecks = [
      ["asset_name", old.asset_name, asset_name],
      ["serial_number", old.serial_number, serial_number],
      ["quantity", old.quantity, quantity],
      ["unit", old.unit, unit], // ✅ NEW (Part 7) — tracked in Main History like every other field
      ["status", old.status, status],
      ["price", old.price, price],
      ["supplier", old.supplier, supplier],
      ["supplier_contact", old.supplier_contact, supplier_contact],
    ];
    for (const [field, oldVal, newVal] of fieldChecks) {
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        await logItemHistory({
          module: "itsupplies",
          record_id: req.params.id,
          action: "EDITED",
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


// ✅ DELETE
router.delete("/:id", async (req, res) => {
  const existing = await pool.query("SELECT asset_name FROM it_supplies WHERE it_supplies_id=$1", [req.params.id]);

  await pool.query(
    "DELETE FROM it_supplies WHERE it_supplies_id=$1",
    [req.params.id]
  );

  await logItemHistory({
    module: "itsupplies",
    record_id: req.params.id,
    action: "DELETED",
    remarks: existing.rows[0]?.asset_name || null,
  });

  res.sendStatus(200);
});

module.exports = router;