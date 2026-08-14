// backend/routes/borrowReturn.js — REQUEST / APPROVE / DENY MODEL
// Generic borrow ledger shared by Event Supplies (module=inventory,
// category="Company Event Supplies") and IT Supplies (module=itsupplies).
//
// ✅ CHANGED (standardized to match Contracts/Wine): borrowing is no
// longer instant. POST /borrow now creates a PENDING request — stock is
// NOT deducted yet. An Admin or Super Admin must approve it (POST
// /:id/approve) before stock is deducted and the item is marked BORROWED,
// or deny it (POST /:id/deny — no stock change). This applies even when
// the requester is themselves an Admin/Super Admin — being the requester
// does not auto-approve; someone (admin or super_admin) still has to
// approve it, same as before for returns.
//
// Status lifecycle: PENDING -> BORROWED -> RETURNED
//                    PENDING -> DENIED
//                    PENDING -> CANCELLED (requester, before decision)
//
// ✅ FIX: GET /:module/:record_id previously ignored :record_id entirely
// (it was a copy-paste of /open/:module) and always returned only
// BORROWED rows for the WHOLE module regardless of which item's DP asked
// for it. Now correctly scoped to the record, and returns every status
// (PENDING/BORROWED/RETURNED/DENIED/CANCELLED) for a full timeline.

const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

const TABLE_MAP = {
  inventory:  { table: "inventory_gen", idCol: "inventory_gen_id", qtyCol: "current_quantity", nameCol: "item_name" },
  itsupplies: { table: "it_supplies",   idCol: "it_supplies_id",   qtyCol: "quantity",          nameCol: "asset_name" },
};

// Resolves a user_id to their name IF they're admin/super_admin, else null.
async function _isApprover(userId) {
  if (!userId) return null;
  const res = await pool.query("SELECT name, role FROM users WHERE user_id=$1", [userId]);
  const row = res.rows[0];
  if (!row || (row.role !== "admin" && row.role !== "super_admin")) return null;
  return row.name;
}

// GET /api/borrow-return/open/:module — everything not yet resolved
// (PENDING awaiting approval, or BORROWED and still out)
// GET /api/borrow-return/open/:module — everything not yet resolved
router.get("/open/:module", async (req, res) => {
  try {
    const { module } = req.params;
    if (!TABLE_MAP[module]) return res.status(400).json({ error: "Invalid module" });

    const result = await pool.query(
      `SELECT br.*, ub.name AS submitted_by_name
       FROM borrow_records br
       LEFT JOIN users ub ON br.borrowed_by_id = ub.user_id
       WHERE br.module=$1 AND br.status IN ('PENDING','BORROWED')
       ORDER BY br.borrow_date ASC`,
      [module]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("BorrowReturn GET /open/:module", err);
    res.status(500).json({ error: "Failed to fetch open borrows" });
  }
});

// GET /api/borrow-return/:module/:record_id — full borrow ledger for ONE item
router.get("/:module/:record_id", async (req, res) => {
  try {
    const { module, record_id } = req.params;
    if (!TABLE_MAP[module]) return res.status(400).json({ error: "Invalid module" });

    const result = await pool.query(
      `SELECT br.*,
              ub.name AS submitted_by_name,
              ur.name AS processed_return_by_name
       FROM borrow_records br
       LEFT JOIN users ub ON br.borrowed_by_id = ub.user_id
       LEFT JOIN users ur ON br.returned_by_id = ur.user_id
       WHERE br.module=$1 AND br.record_id=$2
       ORDER BY br.borrow_date DESC`,
      [module, record_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("BorrowReturn GET /:module/:record_id", err);
    res.status(500).json({ error: "Failed to fetch borrow history" });
  }
});

// POST /api/borrow-return/borrow — create a PENDING request. No stock
// change here — stock is only deducted once an admin/super_admin approves.
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

    // ✅ NEW — true availability = stock minus whatever is already tied up
    // in other PENDING requests for this same item (same over-commit guard
    // wine_withdrawal_requests already uses).
    const pendingRes = await pool.query(
      `SELECT COALESCE(SUM(quantity),0) AS pending_qty
       FROM borrow_records WHERE module=$1 AND record_id=$2 AND status='PENDING'`,
      [module, record_id]
    );
    const pendingQty = parseInt(pendingRes.rows[0].pending_qty) || 0;
    const available  = item.qty - pendingQty;

    if (qty > available) {
      return res.status(400).json({ error: `Cannot request more than available stock (${Math.max(available, 0)} available)` });
    }

    const inserted = await pool.query(
      `INSERT INTO borrow_records
        (module, record_id, quantity, borrowed_by_id, borrowed_by_name, borrow_date, borrow_remarks, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING') RETURNING borrow_id`,
      [module, record_id, qty, user_id || null, borrowed_by.trim(),
       borrow_date || new Date().toISOString().slice(0, 10), remarks || null]
    );

    await logItemHistory({
      module, record_id,
      action: "REQUESTED",
      new_value: `${qty} unit(s)`,
      remarks: `Borrow requested by ${borrowed_by.trim()}${remarks ? " — " + remarks : ""}`,
      performed_by_id: user_id || null,
      performed_by_name: borrowed_by.trim(),
    });

    res.json({ success: true, borrow_id: inserted.rows[0].borrow_id });
  } catch (err) {
    console.error("BorrowReturn POST /borrow", err);
    res.status(500).json({ error: "Failed to submit borrow request" });
  }
});

// POST /api/borrow-return/:id/approve — Admin or Super Admin.
// Deducts stock now and marks BORROWED. Re-checks stock at approval time
// in case it changed since the request was submitted.
router.post("/:id/approve", async (req, res) => {
  try {
    const { admin_id } = req.body;
    const approverName = await _isApprover(admin_id);
    if (!approverName) return res.status(403).json({ error: "Only Admin or Super Admin can approve borrow requests" });

    const recRes = await pool.query("SELECT * FROM borrow_records WHERE borrow_id=$1", [req.params.id]);
    if (!recRes.rows.length) return res.status(404).json({ error: "Request not found" });
    const rec = recRes.rows[0];
    if (rec.status !== "PENDING") return res.status(400).json({ error: `Request is already ${rec.status}` });

    const cfg = TABLE_MAP[rec.module];
    if (!cfg) return res.status(400).json({ error: "Invalid module on record" });

    const itemRes = await pool.query(
      `SELECT ${cfg.qtyCol} AS qty, ${cfg.nameCol} AS name FROM ${cfg.table} WHERE ${cfg.idCol}=$1`,
      [rec.record_id]
    );
    const item = itemRes.rows[0];
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (rec.quantity > item.qty) {
      return res.status(400).json({ error: `Cannot approve — only ${item.qty} in stock` });
    }

    await pool.query(
      `UPDATE ${cfg.table} SET ${cfg.qtyCol} = ${cfg.qtyCol} - $1 WHERE ${cfg.idCol}=$2`,
      [rec.quantity, rec.record_id]
    );

    await pool.query(
      `UPDATE borrow_records
       SET status='BORROWED', approved_by_id=$1, approved_by_name=$2, approved_date=NOW()
       WHERE borrow_id=$3`,
      [admin_id, approverName, req.params.id]
    );

    await logItemHistory({
      module: rec.module, record_id: rec.record_id,
      action: "APPROVED",
      remarks: `Borrow approved — ${rec.quantity} unit(s) to ${rec.borrowed_by_name}`,
      performed_by_id: admin_id,
      performed_by_name: approverName,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("BorrowReturn POST /:id/approve", err);
    res.status(500).json({ error: "Failed to approve request" });
  }
});

// POST /api/borrow-return/:id/deny — Admin or Super Admin. No stock change.
router.post("/:id/deny", async (req, res) => {
  try {
    const { admin_id } = req.body;
    const approverName = await _isApprover(admin_id);
    if (!approverName) return res.status(403).json({ error: "Only Admin or Super Admin can deny borrow requests" });

    const recRes = await pool.query("SELECT * FROM borrow_records WHERE borrow_id=$1", [req.params.id]);
    if (!recRes.rows.length) return res.status(404).json({ error: "Request not found" });
    if (recRes.rows[0].status !== "PENDING") {
      return res.status(400).json({ error: `Request is already ${recRes.rows[0].status}` });
    }

    await pool.query(
      `UPDATE borrow_records SET status='DENIED', denied_by_id=$1, denied_by_name=$2, denied_date=NOW() WHERE borrow_id=$3`,
      [admin_id, approverName, req.params.id]
    );

    await logItemHistory({
      module: recRes.rows[0].module, record_id: recRes.rows[0].record_id,
      action: "DENIED",
      remarks: `Borrow request denied (was ${recRes.rows[0].quantity} unit(s) for ${recRes.rows[0].borrowed_by_name})`,
      performed_by_id: admin_id,
      performed_by_name: approverName,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("BorrowReturn POST /:id/deny", err);
    res.status(500).json({ error: "Failed to deny request" });
  }
});

// DELETE /api/borrow-return/:id — cancel own PENDING request (soft cancel,
// same convention as contracts/wine — never hard-delete the row).
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE borrow_records SET status='CANCELLED' WHERE borrow_id=$1 AND status='PENDING'
       RETURNING module, record_id, borrowed_by_name, quantity`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: "Only pending requests can be cancelled" });
    }

    await logItemHistory({
      module: result.rows[0].module, record_id: result.rows[0].record_id,
      action: "CANCELLED",
      remarks: `Borrow request cancelled (was ${result.rows[0].quantity} unit(s))`,
      performed_by_name: result.rows[0].borrowed_by_name,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("BorrowReturn DELETE /:id", err);
    res.status(500).json({ error: "Failed to cancel request" });
  }
});

// POST /api/borrow-return/return — Admin or Super Admin, finalizes a
// BORROWED record (unchanged role gate from before — still admin-only).
// Body: { borrow_id, returned_by, user_id, remarks, return_date }
router.post("/return", async (req, res) => {
  try {
    const { borrow_id, returned_by, user_id, remarks, return_date } = req.body;

    if (!returned_by || !returned_by.trim()) {
      return res.status(400).json({ error: "Returned By is required" });
    }
    const approverName = await _isApprover(user_id);
    if (!approverName) return res.status(403).json({ error: "Only Admin or Super Admin can process returns" });

    const br = await pool.query("SELECT * FROM borrow_records WHERE borrow_id=$1", [borrow_id]);
    if (!br.rows.length) return res.status(404).json({ error: "Borrow record not found" });
    const rec = br.rows[0];
    if (rec.status !== "BORROWED") return res.status(400).json({ error: `Cannot return a ${rec.status} record` });

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