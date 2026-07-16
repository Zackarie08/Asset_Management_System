// backend/routes/po.js — Main History added
// + Duplicate Log fix (found while auditing the Inventory delete-log bug)
//
// ✅ FIX: Same root cause as Inventory's delete bug. /receive/:id,
// /cancel/:id, and /deliver/:id each called logAction() (system_log)
// server-side AND the frontend (orders.js) ALSO calls addLog() after each
// one resolves — producing two system_log rows per action, one with
// server-resolved attribution and one from the frontend. Removed the
// logAction() calls from those three routes; the frontend's addLog() is
// now the sole system_log source for them, same as every other module.
// POST / (create) is UNCHANGED — the frontend's savePO() never calls
// addLog(), so logAction() there remains the only system_log source and
// was never duplicated.

const express   = require('express');
const router    = express.Router();
const pool      = require('../db');
const logAction = require('../utils/log');
const { logItemHistory } = require('../utils/itemHistory');

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

    const itemRes = await pool.query('SELECT item_name FROM inventory_gen WHERE inventory_gen_id=$1', [item_id]);
    const itemName = itemRes.rows[0]?.item_name || 'item';

    const inserted = await pool.query(
      `INSERT INTO purchase_orders
      (item_id, quantity_ordered, received_quantity, order_date,
      expected_delivery_date, status, remarks, unit,
      performed_by, supplier_name, supplier_contact, unit_price)
      VALUES ($1,$2,0,$3,$4,'ORDERED',$5,$6,$7,$8,$9,$10)
      RETURNING purchase_order_id`,
      [
        item_id, quantity, order_date,
        expected_delivery_date || null, remarks || null,
        unit || null, performed_by || null,
        supplier_name || null, supplier_contact || null, unit_price || null
      ]
    );
    const newId = inserted.rows[0].purchase_order_id;

    // ✅ unchanged — savePO() (frontend) has no addLog() call, so this is
    // the only system_log entry for order creation. Not duplicated.
    await logAction({
      user_id, action_type: 'CREATED PO', module: 'ORDER',
      description: `Created PO for item ID ${item_id} (Qty: ${quantity})`,
      quantity, reference_type: 'MANUAL', performed_by
    });

    await logItemHistory({
      module: 'po',
      record_id: newId,
      action: 'CREATED',
      remarks: `Ordered ${quantity} ${unit || 'unit'}(s) of ${itemName}${supplier_name ? ' from ' + supplier_name : ''}`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
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
      'SELECT p.*, i.item_name FROM purchase_orders p LEFT JOIN inventory_gen i ON p.item_id = i.inventory_gen_id WHERE purchase_order_id=$1', [req.params.id]
    );
    const po = poRes.rows[0];
    if (!po) return res.status(404).send('PO not found');

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

    // ✅ FIX: removed the duplicate logAction() call — submitReceive()
    // (frontend, orders.js) already calls addLog('UPDATE','ORDER',...)
    // with correct attribution after this route resolves.

    await logItemHistory({
      module: 'po',
      record_id: req.params.id,
      action: 'STATUS_CHANGED',
      field_name: 'status',
      old_value: po.status,
      new_value: newStatus,
      remarks: `Received ${qty} ${po.unit || 'unit'}(s) of ${po.item_name || 'item'} (${newReceived}/${po.quantity_ordered} total)`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

    res.json({ status: newStatus, received: newReceived, remaining: po.quantity_ordered - newReceived });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error receiving items');
  }
});

// ── CANCEL ──────────────────────────────────────────────────
router.post('/cancel/:id', async (req, res) => {
  try {
    const { user_id, performed_by, role } = req.body;
    if (role !== 'admin' && role !== 'super_admin') {
      return res.status(403).send('Unauthorized');
    }

    const poRes = await pool.query(
      'SELECT p.*, i.item_name FROM purchase_orders p LEFT JOIN inventory_gen i ON p.item_id = i.inventory_gen_id WHERE purchase_order_id=$1', [req.params.id]
    );
    const po = poRes.rows[0];
    if (!po) return res.status(404).send('Not found');

    if (po.status === 'DELIVERED') return res.status(400).send('Already delivered — cannot cancel');
    if (po.status === 'CANCELLED') return res.status(400).send('Already cancelled');

    await pool.query(
      "UPDATE purchase_orders SET status='CANCELLED' WHERE purchase_order_id=$1",
      [req.params.id]
    );

    // ✅ FIX: removed the duplicate logAction() call — cancelOrder()
    // (frontend, orders.js) already calls addLog('UPDATE','ORDER',...)
    // with correct attribution after this route resolves.

    await logItemHistory({
      module: 'po',
      record_id: req.params.id,
      action: 'CANCELLED',
      old_value: po.status,
      new_value: 'CANCELLED',
      remarks: `Cancelled order for ${po.item_name || 'item'}`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
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
      'SELECT p.*, i.item_name FROM purchase_orders p LEFT JOIN inventory_gen i ON p.item_id = i.inventory_gen_id WHERE purchase_order_id=$1', [req.params.id]
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

    // ✅ FIX: removed the duplicate logAction() call — markDelivered()
    // (frontend, orders.js) already calls addLog('UPDATE','ORDER',...)
    // with correct attribution after this route resolves.

    await logItemHistory({
      module: 'po',
      record_id: req.params.id,
      action: 'STATUS_CHANGED',
      field_name: 'status',
      old_value: po.status,
      new_value: 'DELIVERED',
      remarks: `Full delivery of ${po.item_name || 'item'}`,
      performed_by_id: user_id || null,
      performed_by_name: performed_by || null,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error delivering order');
  }
});

module.exports = router;