// backend/routes/contracts.js — AUDIT FIX PASS
//
// Changes in this revision (see Contracts_Audit_Report.md /
// Contracts_Permissions_Review.md for full root-cause detail):
//
//   • GET / and GET /:id now resolve `current_holder_name` — the employee
//     currently holding a WITH_EMPLOYEE contract — via the latest APPROVED
//     contract_request for that contract, joined to users. Powers the new
//     "With <Name>" status display on the frontend (Change 1).
//
//   • Approve/Deny now enforce SUPER_ADMIN ONLY at the API level via
//     requireSuperAdmin(), which looks the caller's role up from the DB
//     instead of trusting a client-supplied value. Previously these routes
//     performed ZERO role validation — any caller could approve/deny any
//     request (Change 3).
//
//   • Deny now requires (and validates) a JSON body with admin_id — it
//     previously accepted no body at all.
//
//   • Approve/Deny/Return now guard against operating on a request that
//     isn't in the expected state (e.g. double-approving), and return
//     proper 404s instead of throwing on a missing row.
//
//   • Cancel (DELETE /request/:id) now returns 400 with an explicit error
//     if nothing was deleted (e.g. request already approved), instead of
//     silently responding 200 regardless of outcome.
//
//   • NA validity_type support retained from the previous pass.

const router = require("express").Router();
const db     = require("../db");

/* ── ROLE HELPER ─────────────────────────────────────────────
   Looks up the caller's role directly from the users table instead of
   trusting a client-supplied role string. Writes the error response
   itself and returns false when the caller should NOT proceed; returns
   true when the route should continue. */
async function requireSuperAdmin(req, res) {
  const { admin_id } = req.body;

  if (!admin_id) {
    res.status(400).json({ error: "admin_id is required" });
    return false;
  }

  const result = await db.query("SELECT role FROM users WHERE user_id=$1", [admin_id]);
  const role = result.rows[0]?.role;

  if (role !== "super_admin") {
    res.status(403).json({ error: "Only Super Admin can approve or deny contract requests" });
    return false;
  }

  return true;
}

/* ── GET ALL CONTRACTS (with current holder) ────────────────── */
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        c.*,
        holder.name AS current_holder_name
      FROM contracts c
      LEFT JOIN LATERAL (
        SELECT u.name
        FROM contract_requests cr
        JOIN users u ON cr.requested_by = u.user_id
        WHERE cr.contract_id = c.contract_id
          AND cr.status = 'APPROVED'
        ORDER BY cr.approved_date DESC NULLS LAST, cr.request_date DESC
        LIMIT 1
      ) holder ON true
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching contracts");
  }
});

/* ── GET ALL CONTRACT REQUESTS ───────────────────────────────── */
router.get("/requests", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        cr.*,
        c.other_party,
        c.description,
        u.name AS requested_name
      FROM contract_requests cr
      JOIN contracts c ON cr.contract_id = c.contract_id
      JOIN users u ON cr.requested_by = u.user_id
      ORDER BY cr.request_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching requests");
  }
});

/* ── CREATE CONTRACT ─────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      contract_date, other_party, description,
      validity_type, valid_year, valid_from, valid_to, remarks
    } = req.body;

    const cleanYear = validity_type === 'NA' ? null : valid_year;
    const cleanFrom = validity_type === 'NA' ? null : valid_from;
    const cleanTo   = validity_type === 'NA' ? null : valid_to;

    await db.query(`
      INSERT INTO contracts
        (contract_date, other_party, description, validity_type, valid_year, valid_from, valid_to, remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [contract_date, other_party, description, validity_type, cleanYear, cleanFrom, cleanTo, remarks]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating contract");
  }
});

/* ── CREATE REQUEST — with duplicate guard ───────────────────── */
router.post("/request", async (req, res) => {
  try {
    const { contract_id, user_id } = req.body;

    const existing = await db.query(`
      SELECT * FROM contract_requests
      WHERE contract_id=$1
        AND status IN ('PENDING','APPROVED')
    `, [contract_id]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Contract already requested or approved" });
    }

    await db.query(`
      INSERT INTO contract_requests (contract_id, requested_by)
      VALUES ($1,$2)
    `, [contract_id, user_id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating request");
  }
});

/* ── APPROVE REQUEST — ✅ SUPER ADMIN ONLY ─────────────────────── */
router.put("/request/:id/approve", async (req, res) => {
  try {
    const { id }      = req.params;
    const { admin_id } = req.body;

    // ✅ FIX: server-side role enforcement (was trusting the client / no check at all)
    const ok = await requireSuperAdmin(req, res);
    if (!ok) return;

    const reqData = await db.query(
      "SELECT * FROM contract_requests WHERE request_id=$1", [id]
    );
    if (!reqData.rows.length) return res.status(404).json({ error: "Request not found" });

    const request = reqData.rows[0];
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    const contract_id = request.contract_id;

    await db.query(`
      UPDATE contract_requests
      SET status='APPROVED', approved_by=$1, approved_date=NOW()
      WHERE request_id=$2
    `, [admin_id, id]);

    await db.query(
      "UPDATE contracts SET status='WITH_EMPLOYEE' WHERE contract_id=$1",
      [contract_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error approving request");
  }
});

/* ── RETURN CONTRACT ─────────────────────────────────────────── */
router.put("/request/:id/return", async (req, res) => {
  try {
    const { id }  = req.params;
    const reqData = await db.query(
      "SELECT * FROM contract_requests WHERE request_id=$1", [id]
    );
    if (!reqData.rows.length) return res.status(404).json({ error: "Request not found" });

    const contract_id = reqData.rows[0].contract_id;

    await db.query("UPDATE contract_requests SET status='RETURNED' WHERE request_id=$1", [id]);
    await db.query("UPDATE contracts SET status='IN_STORAGE' WHERE contract_id=$1", [contract_id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error returning contract");
  }
});

/* ── DENY REQUEST — ✅ SUPER ADMIN ONLY ────────────────────────── */
router.put("/request/:id/deny", async (req, res) => {
  try {
    // ✅ FIX: previously accepted no body and performed zero validation —
    // any caller could deny any request. Now requires admin_id and
    // enforces super_admin role server-side, same as approve.
    const ok = await requireSuperAdmin(req, res);
    if (!ok) return;

    const reqData = await db.query(
      "SELECT * FROM contract_requests WHERE request_id=$1", [req.params.id]
    );
    if (!reqData.rows.length) return res.status(404).json({ error: "Request not found" });
    if (reqData.rows[0].status !== "PENDING") {
      return res.status(400).json({ error: `Request is already ${reqData.rows[0].status}` });
    }

    await db.query(
      "UPDATE contract_requests SET status='REJECTED' WHERE request_id=$1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error denying request");
  }
});

/* ── CANCEL REQUEST (user) ───────────────────────────────────── */
router.delete("/request/:id", async (req, res) => {
  try {
    // ✅ FIX: now reports failure explicitly instead of always returning 200
    const result = await db.query(
      "DELETE FROM contract_requests WHERE request_id=$1 AND status='PENDING' RETURNING request_id",
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: "Only pending requests can be cancelled" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error cancelling request");
  }
});

/* ── GET SINGLE CONTRACT (with current holder) ───────────────── */
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        c.*,
        holder.name AS current_holder_name
      FROM contracts c
      LEFT JOIN LATERAL (
        SELECT u.name
        FROM contract_requests cr
        JOIN users u ON cr.requested_by = u.user_id
        WHERE cr.contract_id = c.contract_id
          AND cr.status = 'APPROVED'
        ORDER BY cr.approved_date DESC NULLS LAST, cr.request_date DESC
        LIMIT 1
      ) holder ON true
      WHERE c.contract_id=$1
    `, [req.params.id]);

    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching contract");
  }
});

/* ── UPDATE CONTRACT ─────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const {
      contract_date, other_party, description,
      validity_type, valid_year, valid_from, valid_to, remarks, status
    } = req.body;

    const cleanYear = validity_type === 'NA' ? null : valid_year;
    const cleanFrom = validity_type === 'NA' ? null : valid_from;
    const cleanTo   = validity_type === 'NA' ? null : valid_to;

    await db.query(`
      UPDATE contracts SET
        contract_date  = $1,
        other_party    = $2,
        description    = $3,
        validity_type  = $4,
        valid_year     = $5,
        valid_from     = $6,
        valid_to       = $7,
        remarks        = $8,
        status         = $9
      WHERE contract_id = $10
    `, [contract_date, other_party, description, validity_type, cleanYear, cleanFrom, cleanTo, remarks, status, req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating contract");
  }
});

/* ── DELETE CONTRACT ─────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM contracts WHERE contract_id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting contract");
  }
});

module.exports = router;