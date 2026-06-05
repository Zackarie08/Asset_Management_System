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

router.post("/deliver/:id", async (req, res) => {
  const { role } = req.body;
  if (role !== "admin") {
    return res.status(403).send("Unauthorized");
  }
  try {
    const { user_id, performed_by } = req.body;

    // ✅ get PO
    const result = await pool.query(
      "SELECT * FROM purchase_orders WHERE purchase_order_id = $1",
      [req.params.id]
    );

    const po = result.rows[0];
    if (!po) return res.status(404).send("Not found");

    if (po.status === "DELIVERED") {
      return res.status(400).send("Already delivered");
    }

    // ✅ update PO
    await pool.query(
      "UPDATE purchase_orders SET status='DELIVERED', actual_delivery_date=NOW() WHERE purchase_order_id=$1",
      [req.params.id]
    );

    // ✅ update inventory stock
    await pool.query(
      "UPDATE inventory_gen SET current_quantity = current_quantity + $1 WHERE inventory_gen_id = $2",
      [po.quantity_ordered, po.item_id]
    );

    // ✅ log it
    await logAction({
      user_id,
      action_type: "DELIVERED PO",
      module: "ORDER",
      description: `Delivered PO #${po.purchase_order_id}`,
      quantity: po.quantity_ordered,
      movement_type: "ADD",
      reference_type: "DELIVERY",
      performed_by
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error delivering order");
  }
  if (po.status === "CANCELLED") {
    return res.status(400).send("Cannot deliver cancelled order");
  }
});

router.post("/cancel/:id", async (req, res) => {
  const { role } = req.body;
  if (role !== "admin") {
    return res.status(403).send("Unauthorized");
  }
  try {
    const { user_id, performed_by } = req.body;

    const result = await pool.query(
      "SELECT * FROM purchase_orders WHERE purchase_order_id = $1",
      [req.params.id]
    );

    const po = result.rows[0];
    if (!po) return res.status(404).send("Not found");

    if (po.status === "DELIVERED") {
      return res.status(400).send("Already delivered");
    }

    // ✅ update status
    await pool.query(
      "UPDATE purchase_orders SET status='CANCELLED' WHERE purchase_order_id=$1",
      [req.params.id]
    );

    // ✅ log
    await logAction({
      user_id,
      action_type: "CANCELED PO",
      module: "ORDER",
      description: `Cancelled PO #${po.purchase_order_id}`,
      quantity: po.quantity_ordered,
      movement_type: null,
      reference_type: "MANUAL",
      performed_by
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error cancelling order");
  }
  if (po.status === "DELIVERED") {
    return res.status(400).send("Cannot cancel delivered order");
  }
});

module.exports = router;
