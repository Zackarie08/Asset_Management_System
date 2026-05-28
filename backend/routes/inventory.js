const express = require("express");
const router = express.Router();
const pool = require("../db");

// TEMP DATA (simulate DB)
let items = [
  {
    id: 1,
    name: "Bond Paper",
    qty: 10,
    category: "Office Supplies",
    quantity_limit: 5
  }
];

// ✅ GET ALL ITEMS
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM inventory_gen");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});
``

router.post("/", async (req, res) => {
  try {
    const { name, qty, category, quantity_limit, price, unit, remarks} = req.body;

    await pool.query(
      "INSERT INTO inventory_gen (item_name, current_quantity, category, reorder_level, price, unit, remarks) VALUES ($1, $2, $3, $4, $5, $6, %7)",
      [name, qty, category, quantity_limit, price, unit, remarks]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding item");
  }
});

// ✅ WITHDRAW STOCK ONLY
router.post("/withdraw", async (req, res) => {
  try {
    const { id, qty } = req.body;

    await pool.query(
      "UPDATE inventory_gen SET current_quantity = current_quantity - $1 WHERE inventory_gen_id = $2",
      [qty, id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error withdrawing item");
  }
});
``

// ✅ DELETE ITEM
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM inventory_gen WHERE inventory_gen_id = $1",
      [req.params.id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting item");
  }
});


module.exports = router;
``