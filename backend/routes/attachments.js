// backend/routes/attachments.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET all attachments for a record
// GET /api/attachments/:module/:record_id
router.get('/:module/:record_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM attachments
       WHERE module = $1 AND record_id = $2
       ORDER BY uploaded_at DESC`,
      [req.params.module, req.params.record_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// POST upload attachment (base64 data URL stored directly)
// POST /api/attachments
// Body: { module, record_id, file_name, file_url, file_type, uploaded_by }
router.post('/', async (req, res) => {
  try {
    const { module, record_id, file_name, file_url, file_type, uploaded_by } = req.body;

    if (!module || !record_id || !file_name || !file_url) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO attachments (module, record_id, file_name, file_url, file_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [module, record_id, file_name, file_url, file_type || null, uploaded_by || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save attachment' });
  }
});

// DELETE attachment
// DELETE /api/attachments/:attachment_id
router.delete('/:attachment_id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM attachments WHERE attachment_id = $1',
      [req.params.attachment_id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

module.exports = router;
