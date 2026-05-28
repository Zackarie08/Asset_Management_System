const express = require("express");
const router = express.Router();

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
router.get("/", (req, res) => {
  res.json(items);
});

// ✅ ADD NEW ITEM (only create — NOT increase stock)
router.post("/", (req, res) => {
  const { name, qty, category, quantity_limit } = req.body;

  const newItem = {
    id: items.length + 1,
    name,
    qty,
    category,
    quantity_limit
  };

  items.push(newItem);

  res.json(newItem);
});

// ✅ WITHDRAW STOCK ONLY
router.post("/withdraw", (req, res) => {
  const { id, qty } = req.body;

  const item = items.find(i => i.id == id);

  if (!item) {
    return res.status(404).json({ message: "Item not found" });
  }

  if (qty > item.qty) {
    return res.status(400).json({ message: "Not enough stock" });
  }

  item.qty -= qty;

  res.json(item);
});

// ✅ DELETE ITEM
router.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  items = items.filter(item => item.id !== id);

  res.json({ message: "Deleted" });
});

module.exports = router;
``