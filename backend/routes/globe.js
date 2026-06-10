const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT g.*, u.name AS employee_name
    FROM globe_mobile_plan g
    LEFT JOIN users u ON g.user_id = u.user_id
    ORDER BY g.plan_id DESC
  `);

  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const {
    user_id,
    mobile_number,
    account_number,
    plan_name,
    data_allocation,
    monthly_cost,
    credit_limit,
    renewal_date,
    status,
    remarks
  } = req.body;

  await pool.query(`
    INSERT INTO globe_mobile_plan
    (user_id, mobile_number, account_number, plan_name,
     data_allocation, monthly_cost, credit_limit,
     renewal_date, status, remarks)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [
    user_id,
    mobile_number,
    account_number,
    plan_name,
    data_allocation,
    monthly_cost,
    credit_limit,
    renewal_date,
    status,
    remarks
  ]);

  res.sendStatus(200);
});

router.put("/:id", async (req, res) => {
  const {
    user_id,
    mobile_number,
    account_number,
    plan_name,
    data_allocation,
    monthly_cost,
    credit_limit,
    renewal_date,
    status,
    remarks
  } = req.body;

  await pool.query(`
    UPDATE globe_mobile_plan SET
      user_id=$1,
      mobile_number=$2,
      account_number=$3,
      plan_name=$4,
      data_allocation=$5,
      monthly_cost=$6,
      credit_limit=$7,
      renewal_date=$8,
      status=$9,
      remarks=$10
    WHERE plan_id=$11
  `, [
    user_id,
    mobile_number,
    account_number,
    plan_name,
    data_allocation,
    monthly_cost,
    credit_limit,
    renewal_date,
    status,
    remarks,
    req.params.id
  ]);

  res.sendStatus(200);
});



