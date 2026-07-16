// backend/routes/inventory.js — ITEM HISTORY INTEGRATION (Part 8 reference impl)
// + Part 6: Supplier / Supplier Contact fields added to CREATE/EDIT + history.
const express = require("express");
const router = express.Router();
const pool = require("../db");
const logAction = require("../utils/log");
const { logItemHistory } = require("../utils/itemHistory");

// ✅ GET ALL ITEMS
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT i.*, l.location_name FROM inventory_gen i LEFT JOIN location l ON i.location_id = l.location_id ORDER BY i.inventory_gen_id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// ✅ ADD ITEM
router.post("/", async (req, res) => {
  try {
    const { 
      name, qty, category, quantity_limit, price, unit, remarks,
      user_id, performed_by, location_id,
      supplier, supplier_contact, // ✅ NEW (Part 6)
    } = req.body;

    const inserted = await pool.query(
      `INSERT INTO inventory_gen
        (item_name, current_quantity, category, reorder_level, price, unit, remarks, location_id, supplier, supplier_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING inventory_gen_id`,
      [name, qty, category, quantity_limit, price, unit, remarks, location_id, supplier || null, supplier_contact || null]
    );
    const newId = inserted.rows[0].inventory_gen_id;

    await logAction({
      user_id,
      action_type: "CREATE",
      module: "INVENTORY",
      description: `Added ${name}`,
      quantity: qty,
      movement_type: "ADD",
      reference_type: "MANUAL",
      performed_by
    });

    // ✅ NEW: item history entry for this specific record
    await logItemHistory({
      module: "inventory",
      record_id: newId,
      action: "CREATED",
      remarks: `Initial stock: ${qty} ${unit || ''} · ${category}${supplier ? ' · Supplier: ' + supplier : ''}`,
      performed_by_id: user_id,
      performed_by_name: performed_by,
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding item");
  }
});


// ✅ WITHDRAW STOCK
router.post("/withdraw", async (req, res) => {
  try {
    const { id, qty, user_id, performed_by } = req.body;

    const itemRes = await pool.query(
      "SELECT item_name, unit, current_quantity FROM inventory_gen WHERE inventory_gen_id = $1",
      [id]
    );
    const itemName = itemRes.rows[0]?.item_name || `Item #${id}`;
    const unitLabel = itemRes.rows[0]?.unit || "unit";
    const beforeQty = itemRes.rows[0]?.current_quantity;

    await pool.query(
      "UPDATE inventory_gen SET current_quantity = current_quantity - $1 WHERE inventory_gen_id = $2",
      [qty, id]
    );

    await logAction({
      user_id,
      action_type: "WITHDRAW",
      module: "INVENTORY",
      description: `Withdrew ${qty} ${unitLabel}${qty == 1 ? '' : 's'} of ${itemName}`,
      quantity: qty,
      movement_type: "WITHDRAW",
      reference_type: "MANUAL",
      performed_by
    });

    // ✅ NEW
    await logItemHistory({
      module: "inventory",
      record_id: id,
      action: "QUANTITY_ADJUSTED",
      field_name: "current_quantity",
      old_value: beforeQty,
      new_value: beforeQty != null ? beforeQty - qty : null,
      remarks: `Withdrew ${qty} ${unitLabel}${qty == 1 ? '' : 's'}`,
      performed_by_id: user_id,
      performed_by_name: performed_by,
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error withdrawing item");
  }
});


// ✅ DELETE ITEM
router.delete("/:id", async (req, res) => {
  try {
    const user_id = req.query.user_id;
    const performed_by = req.query.performed_by;

    const existing = await pool.query(
      "SELECT item_name FROM inventory_gen WHERE inventory_gen_id = $1",
      [req.params.id]
    );
    const itemName = existing.rows[0]?.item_name || `Item #${req.params.id}`;

    await pool.query(
      "DELETE FROM inventory_gen WHERE inventory_gen_id = $1",
      [req.params.id]
    );

    await logAction({
      user_id,
      action_type: "DELETE",
      module: "INVENTORY",
      description: `Deleted item ID ${req.params.id}`,
      performed_by
    });

    // ✅ NEW — logged AFTER delete since record_id no longer needs to exist
    // in inventory_gen; item_history is independent of the parent row.
    await logItemHistory({
      module: "inventory",
      record_id: req.params.id,
      action: "DELETED",
      remarks: `Deleted "${itemName}"`,
      performed_by_id: user_id,
      performed_by_name: performed_by,
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting item");
  }
});

// ✅ EDIT ITEM
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      category,
      quantity_limit,
      price,
      unit,
      remarks,
      location_id,
      user_id,
      performed_by,
      supplier, supplier_contact, // ✅ NEW (Part 6)
    } = req.body;

    const before = await pool.query(
      `SELECT i.*, l.location_name FROM inventory_gen i
       LEFT JOIN location l ON i.location_id = l.location_id
       WHERE i.inventory_gen_id = $1`,
      [req.params.id]
    );
    const old = before.rows[0];

    // ✅ IMMUTABILITY FIX: resolve the NEW location's name now too, so the
    // history diff is human-readable ("Main Office" → "Warehouse") and not
    // dependent on resolving a location_id at read time later.
    let newLocationName = null;
    if (location_id) {
      const locRes = await pool.query(
        "SELECT location_name FROM location WHERE location_id = $1",
        [location_id]
      );
      newLocationName = locRes.rows[0]?.location_name || null;
    }

    await pool.query(
      `UPDATE inventory_gen
       SET item_name = $1,
           category = $2,
           reorder_level = $3,
           price = $4,
           unit = $5,
           remarks = $6,
           location_id = $7,
           supplier = $8,
           supplier_contact = $9,
           last_updated = NOW()
       WHERE inventory_gen_id = $10`,
      [
        name,
        category,
        quantity_limit,
        price,
        unit,
        remarks,
        location_id,
        supplier || null,
        supplier_contact || null,
        req.params.id
      ]
    );

    await logAction({
      user_id,
      action_type: "UPDATE",
      module: "INVENTORY",
      description: `Updated item: ${name}`,
      movement_type: null,
      reference_type: "MANUAL",
      performed_by
    });

    // ✅ NEW — one history row per changed field, so the timeline reads
    // like "reorder_level: 5 → 10" instead of one vague "Edited" blob.
    if (old) {
      const fieldChecks = [
        ["item_name", old.item_name, name],
        ["category", old.category, category],
        ["reorder_level", old.reorder_level, quantity_limit],
        ["price", old.price, price],
        ["unit", old.unit, unit],
        // ✅ FIX: snapshot location NAME, not the raw location_id FK —
        // see History_Snapshot_Strategy.md
        ["location", old.location_name, newLocationName],
        // ✅ NEW (Part 6): supplier changes now tracked in Item History
        ["supplier", old.supplier, supplier],
        ["supplier_contact", old.supplier_contact, supplier_contact],
      ];
      for (const [field, oldVal, newVal] of fieldChecks) {
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          await logItemHistory({
            module: "inventory",
            record_id: req.params.id,
            action: "EDITED",
            field_name: field,
            old_value: oldVal,
            new_value: newVal,
            performed_by_id: user_id,
            performed_by_name: performed_by,
          });
        }
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating item");
  }
});

module.exports = router;