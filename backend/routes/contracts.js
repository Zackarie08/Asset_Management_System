// backend/routes/contracts.js — IMMUTABILITY FIX PASS + Part 4 audit fix
//
// ✅ FIX (Part 4 audit): PUT /:id only tracked other_party/description/status
// changes in Item History — a change to validity_type/valid_year/valid_from/
// valid_to (e.g. converting a YEAR contract to a RANGE, or extending an
// expiry date) was silently invisible in the item's history timeline.
// Added those four fields to the field-diff check below. Everything else
// (CREATE/REQUEST/APPROVE/DENY/CANCEL/RETURN/DELETE) was already wired into
// Global Item History in the prior pass and is unchanged here.

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
        SELECT cr.requested_name AS name
        FROM contract_requests cr
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
    res.status(500).json({ error: "Error fetching contracts" });
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
        COALESCE(cr.requested_name, '(unknown — recorded before snapshot upgrade)') AS requested_name
      FROM contract_requests cr
      JOIN contracts c ON cr.contract_id = c.contract_id
      ORDER BY cr.request_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching requests" });
  }
});

/* ── CREATE CONTRACT ─────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      contract_date, other_party, description,
      validity_type, valid_year, valid_from, valid_to, remarks,
      user_id, performed_by,
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
    res.status(500).json({ error: "Error creating contract" });
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
    res.status(500).json({ error: "Error creating request" });
  }
});

/* ── APPROVE REQUEST — SUPER ADMIN ONLY ─────────────────────── */
router.put("/request/:id/approve", async (req, res) => {
  try {
    const { id }      = req.params;
    const { admin_id } = req.body;

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
      remarks: `Contract request by ${request.requested_name} approved`,
      performed_by_id: admin_id,
      performed_by_name: adminName,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error approving request" });
  }
});

/* ── RETURN CONTRACT ─────────────────────────────────────────── */
router.put("/request/:id/return", async (req, res) => {
  try {
    const { id }  = req.params;
    const { user_id, performed_by } = req.body; // attribution — now actually sent by the frontend
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
      remarks: `Contract returned by ${reqData.rows[0].requested_name}`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error returning contract" });
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
      remarks: `Contract request by ${reqData.rows[0].requested_name} denied`,
      performed_by_id: admin_id,
      performed_by_name: adminName,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error denying request" });
  }
});

/* ── CANCEL REQUEST (user) ───────────────────────────────────── */
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
      remarks: `Contract request cancelled by requester`,
      performed_by_name: row.requested_name,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cancelling request" });
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
        SELECT cr.requested_name AS name
        FROM contract_requests cr
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
    res.status(500).json({ error: "Error fetching contract" });
  }
});

/* ── UPDATE CONTRACT ─────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const {
      contract_date, other_party, description,
      validity_type, valid_year, valid_from, valid_to, remarks, status,
      user_id, performed_by,
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

    if (old) {
      // ✅ FIX (Part 4 audit): validity_type/valid_year/valid_from/valid_to
      // added — previously a validity change left no trace in Item History.
      const fieldChecks = [
        ["other_party", old.other_party, other_party],
        ["description", old.description, description],
        ["status", old.status, status],
        ["validity_type", old.validity_type, validity_type],
        ["valid_year", old.valid_year, cleanYear],
        ["valid_from", old.valid_from, cleanFrom],
        ["valid_to", old.valid_to, cleanTo],
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
    res.status(500).json({ error: "Error updating contract" });
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
    res.status(500).json({ error: "Error deleting contract" });
  }
});

module.exports = router;