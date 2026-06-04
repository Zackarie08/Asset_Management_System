const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET ALL PO
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM purchase_orders ORDER BY purchase_order_id DESC"
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

    await pool.query(
      `INSERT INTO purchase_orders 
       (item_id, quantity_ordered, order_date, expected_delivery_date, status, remarks, unit)
       VALUES ($1,$2,$3,$4,'ORDERED',$5,$6)`,
      [item_id, quantity, order_date, expected_delivery_date, remarks, unit]
    );

    // ✅ LOG
    await logAction({
      user_id,
      action_type: "CREATE",
      module: "ORDER",
      description: `Created purchase order`,
      quantity,
      movement_type: "ADD",
      reference_type: "ORDER",
      performed_by
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving PO");
  }
});
module.exports = router;
