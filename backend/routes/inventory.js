const express = require("express");
const router = express.Router();
const pool = require("../db");
const logAction = require("../utils/log");

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
      user_id, performed_by, location_id    // ✅ NEW
    } = req.body;

    await pool.query(
      "INSERT INTO inventory_gen (item_name, current_quantity, category, reorder_level, price, unit, remarks, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [name, qty, category, quantity_limit, price, unit, remarks, location_id]
    );

    // ✅ FIXED LOG
    await logAction({
      user_id,                      // ✅ REAL USER
      action_type: "CREATE",
      module: "INVENTORY",
      description: `Added ${name}`,
      quantity: qty,
      movement_type: "ADD",
      reference_type: "MANUAL",
      performed_by             // ✅ REAL PERSON
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

    await pool.query(
      "UPDATE inventory_gen SET current_quantity = current_quantity - $1 WHERE inventory_gen_id = $2",
      [qty, id]
    );

    await logAction({
      user_id,
      action_type: "WITHDRAW",
      module: "INVENTORY",
      description: `Withdraw ${qty}`,
      quantity: qty,
      movement_type: "WITHDRAW",
      reference_type: "MANUAL",
      performed_by
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
      performed_by
    } = req.body;

    await pool.query(
      `UPDATE inventory_gen
       SET item_name = $1,
           category = $2,
           reorder_level = $3,
           price = $4,
           unit = $5,
           remarks = $6,
           location_id = $7,
           last_updated = NOW()
       WHERE inventory_gen_id = $8`,
      [
        name,
        category,
        quantity_limit,
        price,
        unit,
        remarks,
        location_id,
        req.params.id
      ]
    );

    // ✅ LOG EDIT
    await logAction({
      user_id,
      action_type: "UPDATE",
      module: "INVENTORY",
      description: `Updated item: ${name}`,
      movement_type: null,
      reference_type: "MANUAL",
      performed_by
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating item");
  }
});

module.exports = router;