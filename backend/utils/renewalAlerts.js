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
 * given a recurrence cycle. 'one-time' is not advanced — caller checks
 * whether it has already passed via isPastOneTime.
 */
function nextRenewalOccurrence(renewalDateStr, cycle) {
  if (!renewalDateStr) return null;
  const base = _startOfDay(renewalDateStr);
  if (cycle === 'one-time') return base;

  const today = _startOfDay(new Date());
  let next = new Date(base);
  while (next < today) {
    if (cycle === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 1); // yearly (default: M365, Globe, yearly Other subs)
  }
  return next;
}

/**
 * Returns { nextDate, daysUntil, alertActive, isPastOneTime }.
 * cycle: 'monthly' | 'yearly' | 'one-time' (defaults to 'yearly')
 */
function computeRenewalAlert(renewalDateStr, cycle = 'yearly') {
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
      alertActive: daysUntil >= 0 && daysUntil <= 3,
      isPastOneTime: base < today,
    };
  }

  const next = nextRenewalOccurrence(renewalDateStr, cycle);
  const daysUntil = Math.round((next - today) / 86400000);
  return {
    nextDate: next,
    daysUntil,
    alertActive: daysUntil >= 0 && daysUntil <= 3,
    isPastOneTime: false,
  };
}

module.exports = { computeRenewalAlert, nextRenewalOccurrence };

