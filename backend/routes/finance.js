const express = require("express");
const router = express.Router();
const db = require("../db"); // your DB connection

// ✅ GET ALL
router.get("/", async (req, res) => {
  const result = await db.query("SELECT * FROM finance_documents ORDER BY created_at DESC");
  res.json(result.rows);
});

// ✅ GET ONE
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    "SELECT * FROM finance_documents WHERE finance_id = $1",
    [id]
  );

  res.json(result.rows[0]);
});

// ✅ CREATE
router.post("/", async (req, res) => {
  const {
    year,
    folder_number,
    category,
    category_code,
    range_start,
    range_end,
    location,
    remarks
  } = req.body;

  await db.query(
    `INSERT INTO finance_documents
    (year, folder_number, category, category_code, range_start, range_end, location, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [year, folder_number, category, category_code, range_start, range_end, location, remarks]
  );

  res.json({ message: "Created ✅" });
});

// ✅ UPDATE
router.put("/:id", async (req, res) => {
  const { id } = req.params;

  const {
    year,
    folder_number,
    category,
    category_code,
    range_start,
    range_end,
    location,
    remarks
  } = req.body;

  await db.query(
    `UPDATE finance_documents SET
      year=$1,
      folder_number=$2,
      category=$3,
      category_code=$4,
      range_start=$5,
      range_end=$6,
      location=$7,
      remarks=$8
     WHERE finance_id=$9`,
    [year, folder_number, category, category_code, range_start, range_end, location, remarks, id]
  );

  res.json({ message: "Updated ✅" });
});

// ✅ DELETE
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  await db.query("DELETE FROM finance_documents WHERE finance_id=$1", [id]);

  res.json({ message: "Deleted ✅" });
});

module.exports = router;