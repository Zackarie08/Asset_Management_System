const router = require("express").Router();
const db = require("../db");

// ✅ GET ALL CONTRACTS
router.get("/", async (req, res) => {
  const result = await db.query(
    "SELECT * FROM contracts ORDER BY created_at DESC"
  );

  res.json(result.rows);
});


// ✅ GET ALL CONTRACTS
router.get("/requests", async (req, res) => {

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
});


// ✅ CREATE CONTRACT
router.post("/", async (req, res) => {
  const {
    contract_date,
    other_party,
    description,
    validity_type,
    valid_year,
    valid_from,
    valid_to,
    remarks
  } = req.body;

  await db.query(`
    INSERT INTO contracts
    (contract_date, other_party, description, validity_type, valid_year, valid_from, valid_to, remarks)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `, [
    contract_date,
    other_party,
    description,
    validity_type,
    valid_year,
    valid_from,
    valid_to,
    remarks
  ]);

  res.json({ success: true });
});

// ✅ CREATE REQUEST
router.post("/request", async (req, res) => {
  const { contract_id, user_id } = req.body;

  await db.query(`
    INSERT INTO contract_requests (contract_id, requested_by)
    VALUES ($1, $2)
  `, [contract_id, user_id]);

  res.json({ success: true });
});

// ✅ APPROVE REQUEST
router.put("/request/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.body;

  const reqData = await db.query(
    "SELECT * FROM contract_requests WHERE request_id=$1",
    [id]
  );

  const contract_id = reqData.rows[0].contract_id;

  // ✅ UPDATE REQUEST
  await db.query(`
    UPDATE contract_requests
    SET status='APPROVED', approved_by=$1, approved_date=NOW()
    WHERE request_id=$2
  `, [admin_id, id]);

  // ✅ UPDATE CONTRACT STATUS
  await db.query(`
    UPDATE contracts
    SET status='WITH_EMPLOYEE'
    WHERE contract_id=$1
  `, [contract_id]);

  res.json({ success: true });
});

// ✅ RETURN CONTRACT
router.put("/request/:id/return", async (req, res) => {
  const { id } = req.params;

  const reqData = await db.query(
    "SELECT * FROM contract_requests WHERE request_id=$1",
    [id]
  );

  const contract_id = reqData.rows[0].contract_id;

  // ✅ UPDATE REQUEST
  await db.query(`
    UPDATE contract_requests
    SET status='RETURNED'
    WHERE request_id=$1
  `, [id]);

  // ✅ BACK TO STORAGE
  await db.query(`
    UPDATE contracts
    SET status='IN_STORAGE'
    WHERE contract_id=$1
  `, [contract_id]);

  res.json({ success: true });
});

router.put("/request/:id/deny", async (req, res) => {
  const { id } = req.params;

  await db.query(`
    UPDATE contract_requests
    SET status='REJECTED'
    WHERE request_id=$1
  `, [id]);

  res.json({ success: true });
});

router.delete("/request/:id", async (req, res) => {
  const { id } = req.params;

  await db.query(`
    DELETE FROM contract_requests
    WHERE request_id=$1 AND status='PENDING'
  `, [id]);

  res.json({ success: true });
});

// ✅ GET SINGLE CONTRACT
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    "SELECT * FROM contracts WHERE contract_id = $1",
    [id]
  );

  res.json(result.rows[0]);
});

// ✅ UPDATE CONTRACT
router.put("/:id", async (req, res) => {
  const { id } = req.params;

  const {
    contract_date,
    other_party,
    description,
    validity_type,
    valid_year,
    valid_from,
    valid_to,
    remarks,
    status
  } = req.body;

  await db.query(`
    UPDATE contracts SET
      contract_date=$1,
      other_party=$2,
      description=$3,
      validity_type=$4,
      valid_year=$5,
      valid_from=$6,
      valid_to=$7,
      remarks=$8,
      status=$9
    WHERE contract_id=$10
  `, [
    contract_date,
    other_party,
    description,
    validity_type,
    valid_year,
    valid_from,
    valid_to,
    remarks,
    status,
    id
  ]);

  res.json({ success: true });
});


// ✅ DELETE CONTRACT
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  await db.query(
    "DELETE FROM contracts WHERE contract_id=$1",
    [id]
  );

  res.json({ success: true });
});

module.exports = router;