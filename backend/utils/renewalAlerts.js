// backend/utils/renewalAlerts.js
// Shared renewal-notification logic for M365 (yearly), Globe (yearly),
// and Other Subscriptions (monthly / yearly / one-time).
//
// Rule (Subscription_Final_Audit.md): alert window is 3 days before the
// next renewal date through the renewal date itself, inclusive
// (T-3, T-2, T-1, T).

function _startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Returns the next upcoming occurrence (today or future) of a renewal date
 * given a recurrence cycle and step size. 'one-time' is not advanced —
 * caller checks whether it has already passed via isPastOneTime.
 */
function nextRenewalOccurrence(renewalDateStr, cycle, interval = 1) {
  if (!renewalDateStr) return null;
  const base = _startOfDay(renewalDateStr);
  if (cycle === 'one-time') return base;

  // ✅ NEW (Subscription_Interval_Enhancement / Vehicle_TimePlan_Interval):
  // step size is configurable ("Every X Months/Years"). Defaults to 1, so
  // every existing caller (M365, Globe — always yearly interval 1) is
  // unaffected.
  const step = Math.max(1, parseInt(interval) || 1);

  const today = _startOfDay(new Date());
  let next = new Date(base);
  while (next < today) {
    if (cycle === 'monthly') next.setMonth(next.getMonth() + step);
    else next.setFullYear(next.getFullYear() + step); // yearly
  }
  return next;
}

// ✅ CHANGED (Dashboard_Alert_Expansion): lead time widened from 3 days to
// 60 days so M365/Globe/Other Subscriptions/Insurance renewals surface in
// Dashboard alerts (and the "For Renewal" status) much earlier. Keep this
// in sync with RENEWAL_ALERT_WINDOW_DAYS in public/js/utils.js.
const ALERT_WINDOW_DAYS = 60;

/**
 * Returns { nextDate, daysUntil, alertActive, isPastOneTime }.
 * cycle: 'monthly' | 'yearly' | 'one-time' (defaults to 'yearly')
 */
function computeRenewalAlert(renewalDateStr, cycle = 'yearly', interval = 1) {
  if (!renewalDateStr) {
    return { nextDate: null, daysUntil: null, alertActive: false, isPastOneTime: false };
  }

  const today = _startOfDay(new Date());

  if (cycle === 'one-time') {
    const base = _startOfDay(renewalDateStr);
    const daysUntil = Math.round((base - today) / 86400000);
    return {
      nextDate: base,
      daysUntil,
      alertActive: daysUntil >= 0 && daysUntil <= ALERT_WINDOW_DAYS,
      isPastOneTime: base < today,
    };
  }

  const next = nextRenewalOccurrence(renewalDateStr, cycle, interval);
  const daysUntil = Math.round((next - today) / 86400000);
  return {
    nextDate: next,
    daysUntil,
    alertActive: daysUntil >= 0 && daysUntil <= ALERT_WINDOW_DAYS,
    isPastOneTime: false,
  };
}

// ✅ NEW — urgency tiering for Dashboard/notification severity, increasing
// as the date approaches: 60 → 30 → 14 → 7 → 3 → today → overdue.
function renewalSeverity(daysUntil) {
  if (daysUntil === null || daysUntil === undefined) return 'none';
  if (daysUntil < 0)   return 'overdue';
  if (daysUntil <= 3)  return 'critical';
  if (daysUntil <= 7)  return 'urgent';
  if (daysUntil <= 14) return 'high';
  if (daysUntil <= 30) return 'medium';
  if (daysUntil <= 60) return 'low';
  return 'none';
}

module.exports = { computeRenewalAlert, nextRenewalOccurrence, ALERT_WINDOW_DAYS, renewalSeverity };
