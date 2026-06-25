// backend/routes/attachments.js — REFACTORED
// Changes:
//   • Validates module + record_id on every write
//   • Returns file_size_kb in listing
//   • Stores uploaded_by (user_id) properly
//   • All routes have try/catch + meaningful error messages

const express = require("express");
const router  = express.Router();
const pool    = require("../db");

// ── Allowed modules (whitelist to prevent injection) ───────
const ALLOWED_MODULES = [
  "m365", "globe", "subscriptions",
  "inventory", "laptops", "furniture", "itsupplies",
  "vehicles", "contracts", "finance",
];

function validateModule(module) {
  return ALLOWED_MODULES.includes(module);
}

// ── GET all attachments for a record ──────────────────────
// GET /api/attachments/:module/:record_id
router.get("/:module/:record_id", async (req, res) => {
  try {
    const { module, record_id } = req.params;

    if (!validateModule(module)) {
      return res.status(400).json({ error: "Invalid module" });
    }

    const result = await pool.query(`
      SELECT
        a.attachment_id,
        a.file_name,
        a.file_url,
        a.file_type,
        a.file_size_kb,
        a.uploaded_at,
        u.name AS uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.user_id
      WHERE a.module = $1 AND a.record_id = $2
      ORDER BY a.uploaded_at DESC
    `, [module, record_id]);

    res.json(result.rows);
  } catch (err) {
    console.error("Attachments GET /:module/:record_id", err);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

// ── POST upload ────────────────────────────────────────────
// Body: { module, record_id, file_name, file_url, file_type, uploaded_by, file_size_kb }
router.post("/", async (req, res) => {
  try {
    const {
      module,
      record_id,
      file_name,
      file_url,
      file_type,
      uploaded_by,
      file_size_kb,
    } = req.body;

    if (!module || !record_id || !file_name || !file_url) {
      return res.status(400).json({
        error: "module, record_id, file_name, and file_url are required",
      });
    }

    if (!validateModule(module)) {
      return res.status(400).json({ error: "Invalid module" });
    }

    const result = await pool.query(`
      INSERT INTO attachments
        (module, record_id, file_name, file_url, file_type, file_size_kb, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      module,
      record_id,
      file_name,
      file_url,
      file_type || null,
      file_size_kb || null,
      uploaded_by || null,
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Attachments POST /", err);
    res.status(500).json({ error: "Failed to save attachment" });
  }
});

// ── DELETE attachment ──────────────────────────────────────
// DELETE /api/attachments/:attachment_id
router.delete("/:attachment_id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM attachments WHERE attachment_id = $1 RETURNING attachment_id",
      [req.params.attachment_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    res.json({ deleted: result.rows[0].attachment_id });
  } catch (err) {
    console.error("Attachments DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

module.exports = router;
