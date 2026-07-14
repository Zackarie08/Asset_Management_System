// backend/routes/contracts.js — IMMUTABILITY FIX PASS
// See Assignment_History_Protection.md / User_Reference_History_Audit.md
//
// Changes in this revision:
//   - contract_requests now stores requested_name / approved_by_name /
//     denied_by_name SNAPSHOTS at the moment each action happens.
//   - GET /requests reads those snapshot columns directly. A live join to
//     `users` is kept ONLY as a fallback for rows written before migration
//     007 (requested_name IS NULL) — see History_Snapshot_Strategy.md
//     "Grandfathering exception". Every row written from now on is fully
//     snapshotted and never needs that fallback.
//   - current_holder_name (GET / and GET /:id) is UNCHANGED and stays a
//     live LATERAL join — it describes who currently holds the contract
//     right now, which is current state, not a historical record.
//   - Wired into the Global Item History table (item_history, module
//     "contracts") for CREATE/EDIT/REQUEST/APPROVE/DENY/CANCEL/RETURN.
//
// (Prior fixes retained: requireSuperAdmin() server-side role check,
// approve/deny state guards, cancel 400-on-no-op, NA validity_type.)

const router = require("express").Router();
const db     = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

/* ── ROLE HELPER — now also returns the admin's name for snapshotting ── */
async function requireSuperAdmin(req, res) {
  const { admin_id } = req.body;

  if (!admin_id) {
    res.status(400).json({ error: "admin_id is required" });
    return null;
  }

  const result = await db.query("SELECT name, role FROM users WHERE user_id=$1", [admin_id]);
  const row = result.rows[0];

  if (!row || row.role !== "super_admin") {
    res.status(403).json({ error: "Only Super Admin can approve or deny contract requests" });
    return null;
  }

  return row.name; // caller uses this as the snapshot name
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
        -- ✅ FIX: snapshot column is the source of truth. The live join to
        -- users is kept ONLY to backfill requests created before migration
        -- 007 — see the "Grandfathering exception" note in
        -- History_Snapshot_Strategy.md.
        COALESCE(cr.requested_name, u.name) AS requested_name
      FROM contract_requests cr
      JOIN contracts c ON cr.contract_id = c.contract_id
      -- ✅ FIX (Part 5): LEFT JOIN, not JOIN — if the requesting user is
      -- later deleted, an INNER JOIN would silently drop this row from the
      -- timeline entirely. The snapshot column keeps the name regardless.
      LEFT JOIN users u ON cr.requested_by = u.user_id
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
      validity_type, valid_year, valid_from, valid_to, remarks,
      user_id, performed_by, // optional — see note in Global_Item_History_Architecture.md
    } = req.body;

    const cleanYear = validity_type === 'NA' ? null : valid_year;
    const cleanFrom = validity_type === 'NA' ? null : valid_from;
    const cleanTo   = validity_type === 'NA' ? null : valid_to;

    const inserted = await db.query(`
      INSERT INTO contracts
        (contract_date, other_party, description, validity_type, valid_year, valid_from, valid_to, remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING contract_id
    `, [contract_date, other_party, description, validity_type, cleanYear, cleanFrom, cleanTo, remarks]);

    await logItemHistory({
      module: "contracts",
      record_id: inserted.rows[0].contract_id,
      action: "CREATED",
      remarks: `${other_party} — ${description}`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

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

    // ✅ FIX: snapshot the requester's name NOW, permanently.
    const userRes = await db.query("SELECT name FROM users WHERE user_id=$1", [user_id]);
    const requested_name = userRes.rows[0]?.name || null;

    await db.query(`
      INSERT INTO contract_requests (contract_id, requested_by, requested_name)
      VALUES ($1,$2,$3)
    `, [contract_id, user_id, requested_name]);

    await logItemHistory({
      module: "contracts",
      record_id: contract_id,
      action: "REQUESTED",
      new_value: requested_name,
      performed_by_id: user_id,
      performed_by_name: requested_name,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating request");
  }
});

/* ── APPROVE REQUEST — SUPER ADMIN ONLY ─────────────────────── */
router.put("/request/:id/approve", async (req, res) => {
  try {
    const { id }      = req.params;
    const { admin_id } = req.body;

    // ✅ FIX: also returns the admin's name for snapshotting
    const adminName = await requireSuperAdmin(req, res);
    if (adminName === null) return;

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
      SET status='APPROVED', approved_by=$1, approved_by_name=$2, approved_date=NOW()
      WHERE request_id=$3
    `, [admin_id, adminName, id]);

    await db.query(
      "UPDATE contracts SET status='WITH_EMPLOYEE' WHERE contract_id=$1",
      [contract_id]
    );

    await logItemHistory({
      module: "contracts",
      record_id: contract_id,
      action: "APPROVED",
      new_value: request.requested_name,
      remarks: `Request #${id} approved`,
      performed_by_id: admin_id,
      performed_by_name: adminName,
    });

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
    const { user_id, performed_by } = req.body; // optional attribution
    const reqData = await db.query(
      "SELECT * FROM contract_requests WHERE request_id=$1", [id]
    );
    if (!reqData.rows.length) return res.status(404).json({ error: "Request not found" });

    const contract_id = reqData.rows[0].contract_id;

    await db.query("UPDATE contract_requests SET status='RETURNED' WHERE request_id=$1", [id]);
    await db.query("UPDATE contracts SET status='IN_STORAGE' WHERE contract_id=$1", [contract_id]);

    await logItemHistory({
      module: "contracts",
      record_id: contract_id,
      action: "RETURNED",
      remarks: `Request #${id} returned`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error returning contract");
  }
});

/* ── DENY REQUEST — SUPER ADMIN ONLY ────────────────────────── */
router.put("/request/:id/deny", async (req, res) => {
  try {
    const adminName = await requireSuperAdmin(req, res);
    if (adminName === null) return;
    const { admin_id } = req.body;

    const reqData = await db.query(
      "SELECT * FROM contract_requests WHERE request_id=$1", [req.params.id]
    );
    if (!reqData.rows.length) return res.status(404).json({ error: "Request not found" });
    if (reqData.rows[0].status !== "PENDING") {
      return res.status(400).json({ error: `Request is already ${reqData.rows[0].status}` });
    }

    await db.query(
      "UPDATE contract_requests SET status='REJECTED', denied_by_name=$1 WHERE request_id=$2",
      [adminName, req.params.id]
    );

    await logItemHistory({
      module: "contracts",
      record_id: reqData.rows[0].contract_id,
      action: "DENIED",
      remarks: `Request #${req.params.id} denied`,
      performed_by_id: admin_id,
      performed_by_name: adminName,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error denying request");
  }
});

/* ── CANCEL REQUEST (user) ───────────────────────────────────── */
// ✅ FIX (Part 5): previously hard-DELETEd the row, which erased the
// request from the timeline entirely — this was the literal cause of
// "request status disappears after actions occur". Now soft-cancels by
// updating status to CANCELLED, so the row (and its snapshot name)
// survives forever in both contract_requests and the Global Item History
// timeline, and can be displayed instead of vanishing.
router.delete("/request/:id", async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE contract_requests
       SET status='CANCELLED'
       WHERE request_id=$1 AND status='PENDING'
       RETURNING request_id, contract_id, requested_name`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: "Only pending requests can be cancelled" });
    }

    const row = result.rows[0];

    await logItemHistory({
      module: "contracts",
      record_id: row.contract_id,
      action: "CANCELLED",
      remarks: `Request #${req.params.id} cancelled by requester`,
      performed_by_name: row.requested_name,
    });

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
      validity_type, valid_year, valid_from, valid_to, remarks, status,
      user_id, performed_by, // optional — see note below
    } = req.body;

    const cleanYear = validity_type === 'NA' ? null : valid_year;
    const cleanFrom = validity_type === 'NA' ? null : valid_from;
    const cleanTo   = validity_type === 'NA' ? null : valid_to;

    const before = await db.query("SELECT * FROM contracts WHERE contract_id=$1", [req.params.id]);
    const old = before.rows[0];

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

    // NOTE: the frontend's saveContract() does not currently send
    // user_id/performed_by for edits — these fields are optional here so
    // logging degrades gracefully (performed_by_name = null) rather than
    // failing. Wire currentUser into that payload to get full attribution.
    if (old) {
      const fieldChecks = [
        ["other_party", old.other_party, other_party],
        ["description", old.description, description],
        ["status", old.status, status],
      ];
      for (const [field, oldVal, newVal] of fieldChecks) {
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          await logItemHistory({
            module: "contracts",
            record_id: req.params.id,
            action: "EDITED",
            field_name: field,
            old_value: oldVal,
            new_value: newVal,
            performed_by_id: user_id || null,
            performed_by_name: performed_by || null,
          });
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating contract");
  }
});

/* ── DELETE CONTRACT ─────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const existing = await db.query("SELECT other_party FROM contracts WHERE contract_id=$1", [req.params.id]);
    await db.query("DELETE FROM contracts WHERE contract_id=$1", [req.params.id]);

    await logItemHistory({
      module: "contracts",
      record_id: req.params.id,
      action: "DELETED",
      remarks: existing.rows[0]?.other_party || null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting contract");
  }
});

module.exports = router;