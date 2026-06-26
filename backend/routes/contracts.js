// ============================================================
// contracts.js — Contract management
// BUG FIX: Two router.post("/request") handlers existed.
//           Express runs the FIRST match only, so the
//           duplicate-check version was silently ignored,
//           allowing users to create duplicate requests.
// FIX:  Removed the first (no-check) version.
//       Only the version with duplicate-check guard remains.
// ============================================================
const router = require("express").Router();
const db     = require("../db");

/* ── GET ALL CONTRACTS ──────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM contracts ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching contracts");
  }
});

/* ── GET ALL CONTRACT REQUESTS ──────────────────────────── */
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

/* ── CREATE CONTRACT ────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      contract_date, other_party, description,
      validity_type, valid_year, valid_from, valid_to, remarks
    } = req.body;

    await db.query(`
      INSERT INTO contracts
        (contract_date, other_party, description, validity_type, valid_year, valid_from, valid_to, remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [contract_date, other_party, description, validity_type, valid_year, valid_from, valid_to, remarks]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating contract");
  }
});

/* ── CREATE REQUEST — with duplicate guard ──────────────── */
// ✅ FIX: was defined TWICE. First (no-check) version removed.
//         Only this version (with duplicate check) is kept.
router.post("/request", async (req, res) => {
  try {
    const { contract_id, user_id } = req.body;

    // Prevent duplicate active requests for the same contract
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

/* ── APPROVE REQUEST ────────────────────────────────────── */
router.put("/request/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_id } = req.body;

    const reqData = await db.query(
      "SELECT * FROM contract_requests WHERE request_id=$1", [id]
    );
    const contract_id = reqData.rows[0].contract_id;

    await db.query(`
      UPDATE contract_requests
      SET status='APPROVED', approved_by=$1, approved_date=NOW()
      WHERE request_id=$2
    `, [admin_id, id]);

    await db.query(`
      UPDATE contracts SET status='WITH_EMPLOYEE' WHERE contract_id=$1
    `, [contract_id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error approving request");
  }
});

/* ── RETURN CONTRACT ────────────────────────────────────── */
router.put("/request/:id/return", async (req, res) => {
  try {
    const { id } = req.params;
    const reqData = await db.query(
      "SELECT * FROM contract_requests WHERE request_id=$1", [id]
    );
    const contract_id = reqData.rows[0].contract_id;

    await db.query(
      "UPDATE contract_requests SET status='RETURNED' WHERE request_id=$1", [id]
    );
    await db.query(
      "UPDATE contracts SET status='IN_STORAGE' WHERE contract_id=$1", [contract_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error returning contract");
  }
});

/* ── DENY REQUEST ───────────────────────────────────────── */
router.put("/request/:id/deny", async (req, res) => {
  try {
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

/* ── CANCEL REQUEST (user) ──────────────────────────────── */
router.delete("/request/:id", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM contract_requests WHERE request_id=$1 AND status='PENDING'",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error cancelling request");
  }
});

/* ── GET SINGLE CONTRACT ────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM contracts WHERE contract_id=$1", [req.params.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching contract");
  }
});

/* ── UPDATE CONTRACT ────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const {
      contract_date, other_party, description,
      validity_type, valid_year, valid_from, valid_to, remarks, status
    } = req.body;

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
    `, [contract_date, other_party, description, validity_type, valid_year, valid_from, valid_to, remarks, status, req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating contract");
  }
});

/* ── DELETE CONTRACT ────────────────────────────────────── */
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
