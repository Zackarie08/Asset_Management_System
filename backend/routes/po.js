const express = require("express");
const router = express.Router();
const pool = require("../db");
const logAction = require("../utils/log");

// ✅ GET ALL PO
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT p.*, i.item_name FROM purchase_orders p LEFT JOIN inventory_gen i ON p.item_id = i.inventory_gen_id ORDER BY p.purchase_order_id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching PO");
  }
});

// ✅ CREATE PO
router.post("/", async (req, res) => {
  try {
    const {
      item_id,
      quantity,
      order_date,
      expected_delivery_date,
      remarks,
      unit,
      user_id,
      performed_by
    } = req.body;

    // ✅ INSERT PO
    await pool.query(
      `INSERT INTO purchase_orders 
       (item_id, quantity_ordered, order_date, expected_delivery_date, status, remarks, unit)
       VALUES ($1,$2,$3,$4,'ORDERED',$5,$6)`,
      [item_id, quantity, order_date, expected_delivery_date, remarks, unit]
    );

    // ✅ ADD LOG (THIS IS WHAT YOU WERE MISSING)
    await logAction({
      user_id,
      action_type: "CREATED PO",
      module: "ORDER",
      description: `Created PO for item ID ${item_id} (Qty: ${quantity})`,
      quantity: quantity,
      movement_type: null,
      reference_type: "MANUAL",
      performed_by
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving PO");
  }
});

module.exports = router;
