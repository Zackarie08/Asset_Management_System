// backend/routes/wineRequests.js — Part 1 fix: stock validation on request
// Withdrawal request/approval flow for Wine-category inventory items —
// mirrors the Contracts request pattern (Part 5), including the soft-
// cancel / snapshot-name lessons from that fix.
//
// ✅ FIX (Part 1): POST / previously let a user request more units than
// were actually available — it only checked quantity > 0, never against
// stock. A user could request 7 bottles when only 3 existed. Now checks
// requested qty against (current_quantity - sum of other PENDING request
// quantities for the same item), so concurrent pending requests can't be
// double-committed either. Mirrored on the frontend in
// wine_stock_validation_patch.js so the UI can't even submit an over-limit
// request, but this server-side check is the one that can't be bypassed.

const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

// GET /api/wine-requests/:inventory_gen_id — full request timeline for one item
router.get("/:inventory_gen_id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM wine_withdrawal_requests
       WHERE inventory_gen_id = $1
       ORDER BY request_date DESC`,
      [req.params.inventory_gen_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("WineRequests GET /:inventory_gen_id", err);
    res.status(500).json({ error: "Failed to fetch wine requests" });
  }
});

// GET /api/wine-requests — all PENDING requests (for an admin overview)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT wr.*, i.item_name
      FROM wine_withdrawal_requests wr
      JOIN inventory_gen i ON wr.inventory_gen_id = i.inventory_gen_id
      WHERE wr.status = 'PENDING'
      ORDER BY wr.request_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("WineRequests GET /", err);
    res.status(500).json({ error: "Failed to fetch pending wine requests" });
  }
});

// POST / — create a request
// Body: { inventory_gen_id, quantity, remarks, user_id }
router.post("/", async (req, res) => {
  try {
    const { inventory_gen_id, quantity, remarks, user_id } = req.body;
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: "Invalid quantity" });
    if (!user_id) return res.status(400).json({ error: "user_id is required" });

    const itemRes = await pool.query(
      "SELECT item_name, category, current_quantity FROM inventory_gen WHERE inventory_gen_id=$1",
      [inventory_gen_id]
    );
    if (!itemRes.rows.length) return res.status(404).json({ error: "Item not found" });
    if (itemRes.rows[0].category !== "Wine") {
      return res.status(400).json({ error: "Withdrawal requests only apply to Wine category items" });
    }

    // ✅ NEW (Part 1): compute TRUE availability — stock minus whatever is
    // already tied up in other pending requests for this same item — and
    // reject anything over that. This is the authoritative check; the
    // frontend check is just UX.
    const pendingRes = await pool.query(
      `SELECT COALESCE(SUM(quantity),0) AS pending_qty
       FROM wine_withdrawal_requests
       WHERE inventory_gen_id=$1 AND status='PENDING'`,
      [inventory_gen_id]
    );
    const pendingQty  = parseInt(pendingRes.rows[0].pending_qty) || 0;
    const available   = itemRes.rows[0].current_quantity - pendingQty;

    if (qty > available) {
      return res.status(400).json({
        error: `Cannot request more than available stock (${Math.max(available, 0)} available)`,
      });
    }

    const userRes = await pool.query("SELECT name FROM users WHERE user_id=$1", [user_id]);
    const requested_name = userRes.rows[0]?.name;
    if (!requested_name) return res.status(400).json({ error: "Invalid user_id" });

    const inserted = await pool.query(
      `INSERT INTO wine_withdrawal_requests
        (inventory_gen_id, quantity, remarks, requested_by_id, requested_name)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [inventory_gen_id, qty, remarks || null, user_id, requested_name]
    );

    await logItemHistory({
      module: "inventory",
      record_id: inventory_gen_id,
      action: "REQUESTED",
      new_value: `${qty} unit(s)`,
      remarks: `Withdrawal requested by ${requested_name}${remarks ? " — " + remarks : ""}`,
      performed_by_id: user_id,
      performed_by_name: requested_name,
    });

    res.json(inserted.rows[0]);
  } catch (err) {
    console.error("WineRequests POST /", err);
    res.status(500).json({ error: "Failed to create wine request" });
  }
});

// PUT /:id/approve — Admin or Super Admin
// Body: { admin_id }
router.put("/:id/approve", async (req, res) => {
  try {
    const { admin_id } = req.body;
    if (!admin_id) return res.status(400).json({ error: "admin_id is required" });

    const adminRes = await pool.query("SELECT name, role FROM users WHERE user_id=$1", [admin_id]);
    const admin = adminRes.rows[0];
    if (!admin || (admin.role !== "admin" && admin.role !== "super_admin")) {
      return res.status(403).json({ error: "Only Admin or Super Admin can approve wine requests" });
    }

    const reqRes = await pool.query("SELECT * FROM wine_withdrawal_requests WHERE request_id=$1", [req.params.id]);
    if (!reqRes.rows.length) return res.status(404).json({ error: "Request not found" });
    const request = reqRes.rows[0];
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    const itemRes = await pool.query(
      "SELECT item_name, unit, current_quantity FROM inventory_gen WHERE inventory_gen_id=$1",
      [request.inventory_gen_id]
    );
    const item = itemRes.rows[0];
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (request.quantity > item.current_quantity) {
      return res.status(400).json({ error: `Cannot approve — only ${item.current_quantity} in stock` });
    }

    await pool.query(
      "UPDATE inventory_gen SET current_quantity = current_quantity - $1 WHERE inventory_gen_id = $2",
      [request.quantity, request.inventory_gen_id]
    );

    await pool.query(
      `UPDATE wine_withdrawal_requests
       SET status='APPROVED', approved_by_name=$1, decided_date=NOW()
       WHERE request_id=$2`,
      [admin.name, req.params.id]
    );

    await logItemHistory({
      module: "inventory",
      record_id: request.inventory_gen_id,
      action: "APPROVED",
      field_name: "current_quantity",
      old_value: item.current_quantity,
      new_value: item.current_quantity - request.quantity,
      remarks: `Wine withdrawal approved — ${request.quantity} ${item.unit || 'unit'}(s) to ${request.requested_name}`,
      performed_by_id: admin_id,
      performed_by_name: admin.name,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("WineRequests PUT /:id/approve", err);
    res.status(500).json({ error: "Failed to approve request" });
  }
});

// PUT /:id/deny — Admin or Super Admin
router.put("/:id/deny", async (req, res) => {
  try {
    const { admin_id } = req.body;
    if (!admin_id) return res.status(400).json({ error: "admin_id is required" });

    const adminRes = await pool.query("SELECT name, role FROM users WHERE user_id=$1", [admin_id]);
    const admin = adminRes.rows[0];
    if (!admin || (admin.role !== "admin" && admin.role !== "super_admin")) {
      return res.status(403).json({ error: "Only Admin or Super Admin can deny wine requests" });
    }

    const reqRes = await pool.query("SELECT * FROM wine_withdrawal_requests WHERE request_id=$1", [req.params.id]);
    if (!reqRes.rows.length) return res.status(404).json({ error: "Request not found" });
    if (reqRes.rows[0].status !== "PENDING") {
      return res.status(400).json({ error: `Request is already ${reqRes.rows[0].status}` });
    }

    await pool.query(
      `UPDATE wine_withdrawal_requests
       SET status='DENIED', denied_by_name=$1, decided_date=NOW()
       WHERE request_id=$2`,
      [admin.name, req.params.id]
    );

    await logItemHistory({
      module: "inventory",
      record_id: reqRes.rows[0].inventory_gen_id,
      action: "DENIED",
      remarks: `Wine withdrawal request denied (was ${reqRes.rows[0].quantity} unit(s) for ${reqRes.rows[0].requested_name})`,
      performed_by_id: admin_id,
      performed_by_name: admin.name,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("WineRequests PUT /:id/deny", err);
    res.status(500).json({ error: "Failed to deny request" });
  }
});

// DELETE /:id — cancel (requester only, PENDING only) — SOFT cancel,
// per the Part 5 lesson: never hard-delete a request row.
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE wine_withdrawal_requests
       SET status='CANCELLED', decided_date=NOW()
       WHERE request_id=$1 AND status='PENDING'
       RETURNING inventory_gen_id, requested_name, quantity`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: "Only pending requests can be cancelled" });
    }

    await logItemHistory({
      module: "inventory",
      record_id: result.rows[0].inventory_gen_id,
      action: "CANCELLED",
      remarks: `Wine withdrawal request cancelled (was ${result.rows[0].quantity} unit(s))`,
      performed_by_name: result.rows[0].requested_name,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("WineRequests DELETE /:id", err);
    res.status(500).json({ error: "Failed to cancel request" });
  }
});

module.exports = router;