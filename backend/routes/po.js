// backend/routes/po.js — FIXED VERSION
// Changes:
//   • Cancel now works for PARTIAL orders (was blocking with wrong check)
//   • Status logic: ORDERED → PARTIAL → DELIVERED / CANCELLED
//   • Receive blocked when CANCELLED

const express   = require('express');
const router    = express.Router();
const pool      = require('../db');
const logAction = require('../utils/log');

// GET ALL
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, i.item_name
       FROM purchase_orders p
       LEFT JOIN inventory_gen i ON p.item_id = i.inventory_gen_id
       ORDER BY p.purchase_order_id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching PO');
  }
});

// CREATE PO
router.post('/', async (req, res) => {
  try {
    const {
      item_id, quantity, order_date, expected_delivery_date,
      remarks, unit, user_id, performed_by,
      supplier_name, supplier_contact, unit_price
    } = req.body;

    await pool.query(
      `INSERT INTO purchase_orders
      (item_id, quantity_ordered, received_quantity, order_date,
      expected_delivery_date, status, remarks, unit,
      performed_by, supplier_name, supplier_contact, unit_price)
      VALUES ($1,$2,0,$3,$4,'ORDERED',$5,$6,$7,$8,$9,$10)`,
      [
        item_id, quantity, order_date,
        expected_delivery_date || null, remarks || null,
        unit || null, performed_by || null,
        supplier_name || null, supplier_contact || null, unit_price || null
      ]
    );

    await logAction({
      user_id, action_type: 'CREATED PO', module: 'ORDER',
      description: `Created PO for item ID ${item_id} (Qty: ${quantity})`,
      quantity, reference_type: 'MANUAL', performed_by
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving PO');
  }
});

// ── PARTIAL RECEIVE ──────────────────────────────────────────
router.post('/receive/:id', async (req, res) => {
  try {
    const { received_qty, user_id, performed_by } = req.body;
    const qty = parseInt(received_qty);

    if (!qty || qty <= 0) return res.status(400).send('Invalid quantity');

    const poRes = await pool.query(
      'SELECT * FROM purchase_orders WHERE purchase_order_id=$1', [req.params.id]
    );
    const po = poRes.rows[0];
    if (!po) return res.status(404).send('PO not found');

    // ✅ FIX: Block receive if CANCELLED (was only blocking DELIVERED)
    if (po.status === 'DELIVERED' || po.status === 'CANCELLED') {
      return res.status(400).send(`Cannot receive on ${po.status} order`);
    }

    const alreadyReceived = po.received_quantity || 0;
    const remaining       = po.quantity_ordered - alreadyReceived;

    if (qty > remaining) return res.status(400).send(`Cannot receive more than remaining (${remaining})`);
    if (remaining <= 0)  return res.status(400).send('Already fully received');

    const newReceived = alreadyReceived + qty;
    let newStatus = 'ORDERED';
    if (newReceived >= po.quantity_ordered) newStatus = 'DELIVERED';
    else if (newReceived > 0)               newStatus = 'PARTIAL';

    let deliveryDate = null;
    if (newStatus === 'DELIVERED') deliveryDate = new Date().toISOString().slice(0, 10);

    await pool.query(
      `UPDATE purchase_orders SET
        received_quantity=$1, status=$2,
        actual_delivery_date=COALESCE($3::DATE, actual_delivery_date),
        performed_by=$4
       WHERE purchase_order_id=$5`,
      [newReceived, newStatus, deliveryDate, performed_by || null, req.params.id]
    );

    await pool.query(
      `UPDATE inventory_gen SET current_quantity=current_quantity+$1, last_updated=NOW()
       WHERE inventory_gen_id=$2`,
      [qty, po.item_id]
    );

    await logAction({
      user_id, action_type: 'RECEIVE PO', module: 'ORDER',
      description: `Received ${qty} of ${po.quantity_ordered} for PO #${po.purchase_order_id} (${newStatus})`,
      quantity: qty, movement_type: 'ADD', reference_type: 'DELIVERY', performed_by
    });

    res.json({ status: newStatus, received: newReceived, remaining: po.quantity_ordered - newReceived });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error receiving items');
  }
});

// ── CANCEL ──────────────────────────────────────────────────
// ✅ FIX: Now works for PARTIAL orders (was checking po.status === 'DELIVERED' only)
router.post('/cancel/:id', async (req, res) => {
  try {
    const { user_id, performed_by, role } = req.body;
    if (role !== 'admin' && role !== 'super_admin') {
      return res.status(403).send('Unauthorized');
    }

    const poRes = await pool.query(
      'SELECT * FROM purchase_orders WHERE purchase_order_id=$1', [req.params.id]
    );
    const po = poRes.rows[0];
    if (!po) return res.status(404).send('Not found');

    // ✅ FIX: Only block cancel for DELIVERED, not PARTIAL
    if (po.status === 'DELIVERED') return res.status(400).send('Already delivered — cannot cancel');
    if (po.status === 'CANCELLED') return res.status(400).send('Already cancelled');

    await pool.query(
      "UPDATE purchase_orders SET status='CANCELLED' WHERE purchase_order_id=$1",
      [req.params.id]
    );

    await logAction({
      user_id, action_type: 'CANCELED PO', module: 'ORDER',
      description: `Cancelled PO #${po.purchase_order_id} (was ${po.status})`,
      quantity: po.quantity_ordered, reference_type: 'MANUAL', performed_by
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error cancelling order');
  }
});

// Legacy /deliver for backward compat
router.post('/deliver/:id', async (req, res) => {
  const { user_id, performed_by, role } = req.body;
  if (role !== 'admin' && role !== 'super_admin') return res.status(403).send('Unauthorized');

  try {
    const poRes = await pool.query(
      'SELECT * FROM purchase_orders WHERE purchase_order_id=$1', [req.params.id]
    );
    const po = poRes.rows[0];
    if (!po) return res.status(404).send('Not found');

    const remaining = (po.quantity_ordered || 0) - (po.received_quantity || 0);
    if (remaining <= 0) return res.status(400).send('Already fully received');

    await pool.query(
      `UPDATE purchase_orders SET
        received_quantity=quantity_ordered, status='DELIVERED',
        actual_delivery_date=NOW(), performed_by=$1
       WHERE purchase_order_id=$2`,
      [performed_by || null, req.params.id]
    );

    await pool.query(
      `UPDATE inventory_gen SET current_quantity=current_quantity+$1, last_updated=NOW()
       WHERE inventory_gen_id=$2`,
      [remaining, po.item_id]
    );

    await logAction({
      user_id, action_type: 'DELIVERED PO', module: 'ORDER',
      description: `Full delivery of PO #${po.purchase_order_id}`,
      quantity: remaining, movement_type: 'ADD', reference_type: 'DELIVERY', performed_by
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error delivering order');
  }
});

module.exports = router;
