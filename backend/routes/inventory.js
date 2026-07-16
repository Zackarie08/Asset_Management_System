// backend/routes/inventory.js — ITEM HISTORY INTEGRATION (Part 8 reference impl)
// + Part 6 (Supplier fields) + Duplicate Delete Log fix
//
// ✅ FIX (Duplicate Delete Log): DELETE /:id used to call BOTH logAction()
// (system_log) AND logItemHistory() (item_history). The frontend
// (confirmDeleteInventory in inventory.js) ALSO calls addLog() after this
// route resolves — so every inventory delete produced TWO system_log rows:
// one from here (with no performed_by, since the frontend's DELETE fetch
// never sends user_id/performed_by as query params) and one from the
// frontend (with correct attribution). Removed the logAction() call here —
// every other module's delete route (furniture/itSupplies/laptops/vehicle/
// contracts/insurance/finance/users) already relies SOLELY on the frontend
// addLog() call for system_log, with logItemHistory() as the separate,
// untouched Item History record. This just brings Inventory in line.
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
      supplier, supplier_contact,
    } = req.body;

    const inserted = await pool.query(
      `INSERT INTO inventory_gen
        (item_name, current_quantity, category, reorder_level, price, unit, remarks, location_id, supplier, supplier_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING inventory_gen_id`,
      [name, qty, category, quantity_limit, price, unit, remarks, location_id, supplier || null, supplier_contact || null]
    );
    const newId = inserted.rows[0].inventory_gen_id;

    // NOTE: this route's own POST/PUT (create/edit) and /withdraw have NO
    // frontend addLog() counterpart — inventory.js (frontend) never calls
    // addLog() for save/edit/withdraw — so logAction() here remains the
    // SOLE system_log source for those three actions and is correct as-is.
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

    // ✅ FIX: removed the duplicate logAction() (system_log) call that used
    // to sit here — it never received user_id/performed_by (the frontend's
    // DELETE fetch sends no query params), so it always produced a blank-
    // attribution row alongside the frontend's own, correctly-attributed
    // addLog() call. system_log is now written ONLY by the frontend for
    // this action, consistent with every other module.

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
      supplier, supplier_contact,
    } = req.body;

    const before = await pool.query(
      `SELECT i.*, l.location_name FROM inventory_gen i
       LEFT JOIN location l ON i.location_id = l.location_id
       WHERE i.inventory_gen_id = $1`,
      [req.params.id]
    );
    const old = before.rows[0];

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

    if (old) {
      const fieldChecks = [
        ["item_name", old.item_name, name],
        ["category", old.category, category],
        ["reorder_level", old.reorder_level, quantity_limit],
        ["price", old.price, price],
        ["unit", old.unit, unit],
        ["location", old.location_name, newLocationName],
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