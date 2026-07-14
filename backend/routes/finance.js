// backend/routes/finance.js — Part 7 (movement requires Performed By + Remarks)
// See Financial_Document_Movement_History.md
//
// Changes:
//   - NEW: PUT /:id/move — the ONLY way to change `location` now. Requires
//     performed_by + records the movement in Global Item History (module
//     "finance"). The old direct-toggle PUT /:id no longer changes
//     location on its own (see note on PUT /:id below).
//   - CREATE/EDIT/DELETE now also write to item_history.

const express = require("express");
const router = express.Router();
const db = require("../db");
const { logItemHistory } = require("../utils/itemHistory");

// GET ALL
router.get("/", async (req, res) => {
  const result = await db.query("SELECT * FROM finance_documents ORDER BY created_at DESC");
  res.json(result.rows);
});

// GET ONE
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const result = await db.query(
    "SELECT * FROM finance_documents WHERE finance_id = $1",
    [id]
  );
  res.json(result.rows[0]);
});

// CREATE
router.post("/", async (req, res) => {
  const {
    year, folder_number, category, category_code,
    range_start, range_end, location, remarks,
    user_id, performed_by,
  } = req.body;

  const inserted = await db.query(
    `INSERT INTO finance_documents
    (year, folder_number, category, category_code, range_start, range_end, location, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING finance_id`,
    [year, folder_number, category, category_code, range_start, range_end, location, remarks]
  );

  await logItemHistory({
    module: "finance",
    record_id: inserted.rows[0].finance_id,
    action: "CREATED",
    remarks: `${category_code}${year}${String(range_start).padStart(4,'0')}-${String(range_end).padStart(4,'0')} · ${location}`,
    performed_by_id: user_id || null,
    performed_by_name: performed_by || null,
  });

  res.json({ message: "Created ✅" });
});

// UPDATE (fields other than location — see PUT /:id/move for movement)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    year, folder_number, category, category_code,
    range_start, range_end, remarks,
    user_id, performed_by,
    // NOTE: location intentionally NOT accepted here — use PUT /:id/move,
    // which enforces performed_by + remarks. This endpoint keeps whatever
    // location the record currently has.
  } = req.body;

  const before = await db.query("SELECT * FROM finance_documents WHERE finance_id=$1", [id]);
  const old = before.rows[0];

  await db.query(
    `UPDATE finance_documents SET
      year=$1,
      folder_number=$2,
      category=$3,
      category_code=$4,
      range_start=$5,
      range_end=$6,
      remarks=$7
     WHERE finance_id=$8`,
    [year, folder_number, category, category_code, range_start, range_end, remarks, id]
  );

  if (old) {
    const fieldChecks = [
      ["year", old.year, year],
      ["folder_number", old.folder_number, folder_number],
      ["category", old.category, category],
      ["range_start", old.range_start, range_start],
      ["range_end", old.range_end, range_end],
    ];
    for (const [field, oldVal, newVal] of fieldChecks) {
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        await logItemHistory({
          module: "finance",
          record_id: id,
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

  res.json({ message: "Updated ✅" });
});

// ✅ NEW — MOVE (the only path that changes `location`)
// Body: { performed_by (required), remarks (required), user_id }
router.put("/:id/move", async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by, remarks, user_id } = req.body;

    if (!performed_by || !performed_by.trim()) {
      return res.status(400).json({ error: "Performed By is required to move a document" });
    }
    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ error: "Remarks are required to move a document" });
    }

    const existing = await db.query("SELECT * FROM finance_documents WHERE finance_id=$1", [id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Document not found" });
    const f = existing.rows[0];

    const newLocation = f.location === "STORAGE" ? "OFFICE" : "STORAGE";

    await db.query("UPDATE finance_documents SET location=$1 WHERE finance_id=$2", [newLocation, id]);

    await logItemHistory({
      module: "finance",
      record_id: id,
      action: "LOCATION_MOVED",
      field_name: "location",
      old_value: f.location,
      new_value: newLocation,
      remarks: remarks.trim(),
      performed_by_id: user_id || null,
      performed_by_name: performed_by.trim(),
    });

    res.json({ message: "Moved ✅", location: newLocation });
  } catch (err) {
    console.error("Finance PUT /:id/move", err);
    res.status(500).json({ error: "Error moving document" });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const existing = await db.query("SELECT category, folder_number FROM finance_documents WHERE finance_id=$1", [id]);

  await db.query("DELETE FROM finance_documents WHERE finance_id=$1", [id]);

  await logItemHistory({
    module: "finance",
    record_id: id,
    action: "DELETED",
    remarks: existing.rows[0] ? `${existing.rows[0].category} · Folder #${existing.rows[0].folder_number}` : null,
  });

  res.json({ message: "Deleted ✅" });
});

module.exports = router;