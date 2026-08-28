// backend/routes/notifications.js — Part 1
// See Dashboard_Notification_System.md
//
// Notifications are computed LIVE from existing tables (never stored) —
// only which ones a given user has SEEN is persisted (notification_seen).
// Badge count = live alerts MINUS alerts this user has already viewed.

const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const { computeRenewalAlert } = require("../utils/renewalAlerts");
const { computePlanStatus } = require("../utils/vehiclePlanStatus"); // ✅ NEW

async function collectNotifications() {
  const notifications = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // ── Contracts — expiring within 30 days ──
  const contracts = await pool.query(
    `SELECT contract_id, other_party, validity_type, valid_year, valid_to, auto_renew FROM contracts`
  );
  contracts.rows.forEach(c => {
    if (c.validity_type === 'NA') return;
    if (c.auto_renew) return; // ✅ NEW — auto-renewing contracts never lapse, so no expiry alert
    const expiry = c.validity_type === 'YEAR' && c.valid_year
      ? new Date(`${c.valid_year}-12-31`)
      : (c.valid_to ? new Date(c.valid_to) : null);
    if (!expiry) return;
    const days = Math.ceil((expiry - today) / 86400000);
    if (days <= 30) {
      notifications.push({
        module: 'contracts', record_id: c.contract_id,
        type: days < 0 ? 'CONTRACT_EXPIRED' : 'CONTRACT_EXPIRING',
        severity: days < 0 ? 'red' : 'amber',
        label: c.other_party,
        detail: days < 0 ? 'Contract expired' : `Expires in ${days}d`,
      });
    }
  });

  // ── Pending contract requests — keyed to the CONTRACT, same as above,
  //    so opening the contract's DP clears both kinds of alert at once ──
  const reqs = await pool.query(`
    SELECT cr.request_id, cr.contract_id, c.other_party,
           COALESCE(cr.requested_name, u.name) AS requested_name
    FROM contract_requests cr
    JOIN contracts c ON cr.contract_id = c.contract_id
    LEFT JOIN users u ON cr.requested_by = u.user_id
    WHERE cr.status = 'PENDING'
  `);
  reqs.rows.forEach(r => {
    notifications.push({
      module: 'contracts', record_id: r.contract_id,
      type: 'CONTRACT_REQUEST_PENDING', severity: 'amber',
      label: r.other_party, detail: `Requested by ${r.requested_name || '—'}`,
    });
  });

  // ── M365 renewals ──
  const m365 = await pool.query(`SELECT license_id, assigned_email, renewal_date, auto_renew FROM m365`);
  m365.rows.forEach(m => {
    if (m.auto_renew) return; // ✅ NEW
    const alert = computeRenewalAlert(m.renewal_date, 'yearly');
    if (alert.alertActive) {
      notifications.push({
        module: 'm365', record_id: m.license_id,
        type: 'M365_RENEWAL', severity: 'amber',
        label: m.assigned_email, detail: 'M365 license renewal due',
      });
    }
  });

  // ── Globe renewals ──
  const globe = await pool.query(`SELECT plan_id, plan_name, status, renewal_date, auto_renew FROM globe_mobile_plan`);
  globe.rows.forEach(g => {
    if (g.status === 'Inactive') return;
    if (g.auto_renew) return; // ✅ NEW
    const alert = computeRenewalAlert(g.renewal_date, 'yearly');
    if (alert.alertActive) {
      notifications.push({
        module: 'globe', record_id: g.plan_id,
        type: 'GLOBE_RENEWAL', severity: 'amber',
        label: g.plan_name || 'Globe Plan', detail: 'Globe plan renewal due',
      });
    }
  });

  // ── Other subscriptions ──
  const subs = await pool.query(
    `SELECT subscription_id, subscription_name, billing_cycle, billing_interval, renewal_date, status, auto_renew FROM subscriptions`
  );
  subs.rows.forEach(s => {
    if (s.status === 'Cancelled') return;
    if (s.auto_renew) return; // ✅ NEW
    const alert = computeRenewalAlert(s.renewal_date, s.billing_cycle, s.billing_interval);
    if (alert.alertActive) {
      notifications.push({
        module: 'subscriptions', record_id: s.subscription_id,
        type: 'SUBSCRIPTION_RENEWAL', severity: 'amber',
        label: s.subscription_name, detail: 'Subscription renewal due',
      });
    }
  });

  // ── Wine withdrawal requests — pending ──
  const wineReqPending = await pool.query(`
    SELECT wr.request_id, wr.inventory_gen_id, wr.requested_name, i.item_name
    FROM wine_withdrawal_requests wr
    JOIN inventory_gen i ON wr.inventory_gen_id = i.inventory_gen_id
    WHERE wr.status = 'PENDING'
  `);
  wineReqPending.rows.forEach(r => {
    notifications.push({
      module: 'inventory', record_id: r.inventory_gen_id,
      type: 'WINE_REQUEST_PENDING', severity: 'amber',
      label: r.item_name, detail: `Withdrawal requested by ${r.requested_name || '—'}`,
    });
  });

  // ── Event Supplies / IT Supplies — pending borrow requests ──
  const pendingBorrows = await pool.query(`SELECT * FROM borrow_records WHERE status = 'PENDING'`);
  if (pendingBorrows.rows.length) {
    const invIds = pendingBorrows.rows.filter(b => b.module === 'inventory').map(b => b.record_id);
    const itIds  = pendingBorrows.rows.filter(b => b.module === 'itsupplies').map(b => b.record_id);

    const invNamesRes = invIds.length
      ? await pool.query(`SELECT inventory_gen_id, item_name FROM inventory_gen WHERE inventory_gen_id = ANY($1::int[])`, [invIds])
      : { rows: [] };
    const itNamesRes = itIds.length
      ? await pool.query(`SELECT it_supplies_id, asset_name FROM it_supplies WHERE it_supplies_id = ANY($1::int[])`, [itIds])
      : { rows: [] };

    const invNameMap = {}; invNamesRes.rows.forEach(r => { invNameMap[r.inventory_gen_id] = r.item_name; });
    const itNameMap  = {}; itNamesRes.rows.forEach(r => { itNameMap[r.it_supplies_id] = r.asset_name; });

    // ✅ FIX: skip orphaned requests whose underlying item was deleted —
    // same root cause as the Dashboard "Item #123" bug (borrow_records has
    // no FK to inventory_gen/it_supplies). If the name lookup came back
    // empty, the item no longer exists — don't notify for it.
    pendingBorrows.rows.forEach(b => {
      const label = b.module === 'inventory' ? invNameMap[b.record_id] : itNameMap[b.record_id];
      if (!label) return;
      notifications.push({
        module: b.module, record_id: b.record_id,
        type: 'BORROW_REQUEST_PENDING', severity: 'amber',
        label, detail: `Borrow requested by ${b.borrowed_by_name || '—'} · awaiting approval`,
      });
    });
  }

  // ── Insurance — expiring within 60 days (Dashboard_Alert_Expansion) ──
  const ins = await pool.query(`SELECT insurance_id, employee_name, expiry_date FROM insurance`);
  ins.rows.forEach(i => {
    if (!i.expiry_date) return;
    const days = Math.ceil((new Date(i.expiry_date) - today) / 86400000);
    if (days <= 60) {
      notifications.push({
        module: 'insurance', record_id: i.insurance_id,
        type: days < 0 ? 'INSURANCE_EXPIRED' : 'INSURANCE_EXPIRING',
        severity: days < 0 || days <= 7 ? 'red' : 'amber',
        label: i.employee_name, detail: days < 0 ? 'Policy expired' : `Expires in ${days}d`,
      });
    }
  });

  // ── Vehicle maintenance — driven ONLY by custom maintenance plans now
  // (vehicle_maintenance_types), both odometer-based and time-based.
  // ✅ REMOVED: the old vehicle.last_maintenance_km / .maintenance_threshold
  // fixed "1000 km since last service" check. That data is stale/unused
  // once a vehicle has real plans — it no longer reflects actual service
  // state, so it must not drive the Dashboard or the red-dot count anymore.
  const vehicles = await pool.query(
    `SELECT vehicle_id, vehicle_name, status, odometer FROM vehicle`
  );
  const vehiclePlansRes = await pool.query(`SELECT * FROM vehicle_maintenance_types`);
  const plansByVehicle = {};
  vehiclePlansRes.rows.forEach(p => {
    (plansByVehicle[p.vehicle_id] = plansByVehicle[p.vehicle_id] || []).push(p);
  });

  vehicles.rows.forEach(v => {
    if (v.status === 'UNDER_MAINTENANCE') {
      notifications.push({
        module: 'vehicle', record_id: v.vehicle_id,
        type: 'VEHICLE_MAINTENANCE', severity: 'blue',
        label: v.vehicle_name, detail: 'Under maintenance',
      });
      return;
    }

    const plans     = plansByVehicle[v.vehicle_id] || [];
    const currentKm = v.odometer || 0;

    // One notification per vehicle (matches the pre-existing pattern) —
    // pick the worst plan status across all of this vehicle's plans,
    // overdue outranking due_soon.
    let worst = null;
    plans.forEach(p => {
      const { status } = computePlanStatus(p, currentKm);
      if (status === 'overdue') {
        worst = { status: 'overdue', plan: p };
      } else if (status === 'due_soon' && (!worst || worst.status !== 'overdue')) {
        worst = { status: 'due_soon', plan: p };
      }
    });

    if (worst) {
      notifications.push({
        module: 'vehicle', record_id: v.vehicle_id,
        type: 'VEHICLE_MAINTENANCE_DUE',
        severity: worst.status === 'overdue' ? 'red' : 'amber',
        label: v.vehicle_name,
        detail: `${worst.plan.name}: ${worst.status === 'overdue' ? 'Overdue' : 'Due soon'}`,
      });
    }
  });

  return notifications;
}

// GET /api/notifications/:user_id — unresolved (unseen) notifications
router.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const all = await collectNotifications();

    // ✅ Cleanup: drop "seen" rows for alerts that are no longer active, so
    // if the same record triggers a fresh alert later (e.g. next year's
    // renewal), it notifies again instead of staying permanently silenced.
    const activeKeys = all.map(n => `${n.module}:${n.record_id}`);
    await pool.query(
      `DELETE FROM notification_seen
       WHERE user_id = $1
         AND (module || ':' || record_id) NOT IN (SELECT unnest($2::text[]))`,
      [user_id, activeKeys]
    );

    const seenRes = await pool.query(
      `SELECT module, record_id FROM notification_seen WHERE user_id = $1`,
      [user_id]
    );
    const seenSet = new Set(seenRes.rows.map(r => `${r.module}:${r.record_id}`));

    const unseen = all.filter(n => !seenSet.has(`${n.module}:${n.record_id}`));

    res.json({ count: unseen.length, items: unseen });
  } catch (err) {
    console.error("Notifications GET /:user_id", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// POST /api/notifications/seen — mark one notification acknowledged
router.post("/seen", async (req, res) => {
  try {
    const { user_id, module, record_id } = req.body;
    if (!user_id || !module || !record_id) {
      return res.status(400).json({ error: "user_id, module, and record_id are required" });
    }
    await pool.query(
      `INSERT INTO notification_seen (user_id, module, record_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id, module, record_id) DO NOTHING`,
      [user_id, module, record_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Notifications POST /seen", err);
    res.status(500).json({ error: "Failed to mark notification seen" });
  }
});

module.exports = router;
