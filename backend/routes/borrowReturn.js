// backend/routes/borrowReturn.js — Parts 2 & 3
// Generic borrow/return ledger shared by Event Supplies (module=inventory,
// category="Company Event Supplies") and IT Supplies (module=itsupplies).
// See Inventory_Borrow_Return_System.md / ITSupplies_Borrow_Return_System.md

const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

const TABLE_MAP = {
  inventory:  { table: "inventory_gen", idCol: "inventory_gen_id", qtyCol: "current_quantity", nameCol: "item_name" },
  itsupplies: { table: "it_supplies",   idCol: "it_supplies_id",   qtyCol: "quantity",          nameCol: "asset_name" },
};

// GET /api/borrow-return/:module/:record_id — full borrow ledger for one item
router.get("/:module/:record_id", async (req, res) => {
  try {
    const { module, record_id } = req.params;
    if (!TABLE_MAP[module]) return res.status(400).json({ error: "Invalid module" });

    const result = await pool.query(
      `SELECT * FROM borrow_records WHERE module=$1 AND record_id=$2 ORDER BY borrow_date DESC, created_at DESC`,
      [module, record_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("BorrowReturn GET /:module/:record_id", err);
    res.status(500).json({ error: "Failed to fetch borrow records" });
  }
});

// GET /api/borrow-return/open/:module — everything currently out, any item
router.get("/open/:module", async (req, res) => {
  try {
    const { module } = req.params;
    if (!TABLE_MAP[module]) return res.status(400).json({ error: "Invalid module" });

    const result = await pool.query(
      `SELECT * FROM borrow_records WHERE module=$1 AND status='BORROWED' ORDER BY borrow_date ASC`,
      [module]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("BorrowReturn GET /open/:module", err);
    res.status(500).json({ error: "Failed to fetch open borrows" });
  }
});

// POST /api/borrow-return/borrow
// Body: { module, record_id, quantity, borrowed_by, user_id, remarks, borrow_date }
router.post("/borrow", async (req, res) => {
  try {
    const { module, record_id, quantity, borrowed_by, user_id, remarks, borrow_date } = req.body;
    const cfg = TABLE_MAP[module];
    if (!cfg) return res.status(400).json({ error: "Invalid module" });

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: "Invalid quantity" });
    if (!borrowed_by || !borrowed_by.trim()) return res.status(400).json({ error: "Borrowed By is required" });

    const itemRes = await pool.query(
      `SELECT ${cfg.qtyCol} AS qty, ${cfg.nameCol} AS name FROM ${cfg.table} WHERE ${cfg.idCol}=$1`,
      [record_id]
    );
    if (!itemRes.rows.length) return res.status(404).json({ error: "Item not found" });
    const item = itemRes.rows[0];

    if (qty > item.qty) {
      return res.status(400).json({ error: `Cannot borrow more than available (${item.qty})` });
    }

    await pool.query(
      `UPDATE ${cfg.table} SET ${cfg.qtyCol} = ${cfg.qtyCol} - $1 WHERE ${cfg.idCol}=$2`,
      [qty, record_id]
    );

    const inserted = await pool.query(
      `INSERT INTO borrow_records
        (module, record_id, quantity, borrowed_by_id, borrowed_by_name, borrow_date, borrow_remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING borrow_id`,
      [module, record_id, qty, user_id || null, borrowed_by.trim(),
       borrow_date || new Date().toISOString().slice(0, 10), remarks || null]
    );

    await logItemHistory({
      module, record_id,
      action: "BORROWED",
      new_value: `${qty} unit(s)`,
      remarks: `Borrowed by ${borrowed_by.trim()}${remarks ? " — " + remarks : ""}`,
      performed_by_id: user_id || null,
      performed_by_name: borrowed_by.trim(),
    });

    res.json({ success: true, borrow_id: inserted.rows[0].borrow_id });
  } catch (err) {
    console.error("BorrowReturn POST /borrow", err);
    res.status(500).json({ error: "Failed to record borrow" });
  }
});

// POST /api/borrow-return/return
// Body: { borrow_id, returned_by, user_id, remarks, return_date }
// (Full return only — the borrowed quantity is returned as a whole unit.)
router.post("/return", async (req, res) => {
  try {
    const { borrow_id, returned_by, user_id, remarks, return_date } = req.body;

    if (!returned_by || !returned_by.trim()) {
      return res.status(400).json({ error: "Returned By is required" });
    }

    const br = await pool.query("SELECT * FROM borrow_records WHERE borrow_id=$1", [borrow_id]);
    if (!br.rows.length) return res.status(404).json({ error: "Borrow record not found" });
    const rec = br.rows[0];
    if (rec.status === "RETURNED") return res.status(400).json({ error: "Already returned" });

    const cfg = TABLE_MAP[rec.module];
    if (!cfg) return res.status(400).json({ error: "Invalid module on record" });

    await pool.query(
      `UPDATE ${cfg.table} SET ${cfg.qtyCol} = ${cfg.qtyCol} + $1 WHERE ${cfg.idCol}=$2`,
      [rec.quantity, rec.record_id]
    );

    await pool.query(
      `UPDATE borrow_records SET
        status='RETURNED', returned_by_id=$1, returned_by_name=$2,
        return_date=$3, return_remarks=$4
       WHERE borrow_id=$5`,
      [user_id || null, returned_by.trim(), return_date || new Date().toISOString().slice(0, 10), remarks || null, borrow_id]
    );

    await logItemHistory({
      module: rec.module, record_id: rec.record_id,
      action: "RETURNED",
      new_value: `${rec.quantity} unit(s)`,
      remarks: `Returned by ${returned_by.trim()}${remarks ? " — " + remarks : ""} (originally borrowed by ${rec.borrowed_by_name})`,
      performed_by_id: user_id || null,
      performed_by_name: returned_by.trim(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("BorrowReturn POST /return", err);
    res.status(500).json({ error: "Failed to record return" });
  }
});

module.exports = router;
