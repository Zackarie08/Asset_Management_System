// backend/utils/vehiclePlanStatus.js
// Shared plan-status computation for vehicle maintenance plans — used by
// BOTH backend/routes/vehicleMaintPlans.js (Detail Panel / plan cards) and
// backend/routes/notifications.js (Dashboard alerts / red-dot), so the two
// can never disagree on what counts as "due soon" or "overdue".
//
// IMPORTANT: vehicle.last_maintenance_km / vehicle.maintenance_threshold
// (the old fixed "1000 km since last service" columns on the `vehicle`
// table itself) are intentionally NOT used anywhere in this file or by
// any alert/notification code. Once a vehicle has custom maintenance
// plans (vehicle_maintenance_types), those plans are the only source of
// truth for maintenance alerts — odometer-based AND time-based.
//
// Odometer-based plan:
//   progress% = (currentKm - plan.last_maintenance_km) / plan.threshold_km
//   >= 100% => overdue, >= 90% => due_soon, else ok
//
// Time-based plan:
//   next_due = plan.last_performed_date + (interval_value * interval_unit)
//   past due => overdue, within DUE_SOON_WINDOW_DAYS => due_soon, else ok

const DUE_SOON_WINDOW_DAYS = 60;

function odometerPlanStatus(plan, currentKm) {
  const base      = plan.last_maintenance_km || 0;
  const interval  = plan.threshold_km || 0;
  const nextDueKm = base + interval;

  if (!interval) {
    return { status: 'unknown', nextDueKm, pct: null };
  }

  const pct = ((currentKm - base) / interval) * 100;
  let status = 'ok';
  if (pct >= 100) status = 'overdue';
  else if (pct >= 90) status = 'due_soon';

  return { status, nextDueKm, pct: Math.round(pct) };
}

function timePlanStatus(plan) {
  if (!plan.last_performed_date) {
    return { status: 'pending', nextDueDate: null, daysLeft: null };
  }

  const step = Math.max(1, parseInt(plan.interval_value) || 1);
  const last = new Date(plan.last_performed_date);
  const next = new Date(last);
  if (plan.interval_unit === 'month') next.setMonth(next.getMonth() + step);
  else next.setFullYear(next.getFullYear() + step);

  const daysLeft = Math.ceil((next - new Date()) / (1000 * 60 * 60 * 24));
  let status = 'ok';
  if (daysLeft < 0) status = 'overdue';
  else if (daysLeft <= DUE_SOON_WINDOW_DAYS) status = 'due_soon';

  return { status, nextDueDate: next.toISOString().slice(0, 10), daysLeft };
}

// ✅ NEW — One-Time Date basis: a single fixed due date, no recurrence.
// Once performed (last_performed_date set), the plan stays visible but
// permanently reports 'completed' — no more due date, no more alerts.
function oneTimePlanStatus(plan) {
  if (plan.last_performed_date) {
    return { status: 'completed', daysLeft: null };
  }
  if (!plan.due_date) {
    return { status: 'pending', daysLeft: null };
  }
  const due = new Date(plan.due_date);
  const daysLeft = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
  let status = 'ok';
  if (daysLeft < 0) status = 'overdue';
  else if (daysLeft <= DUE_SOON_WINDOW_DAYS) status = 'due_soon';
  return { status, daysLeft };
}

function computePlanStatus(plan, currentKm) {
  if (plan.basis === 'odometer') return odometerPlanStatus(plan, currentKm);
  if (plan.basis === 'one_time') return oneTimePlanStatus(plan);
  return timePlanStatus(plan);
}

module.exports = {
  computePlanStatus,
  odometerPlanStatus,
  timePlanStatus,
  oneTimePlanStatus,
  DUE_SOON_WINDOW_DAYS,
};
