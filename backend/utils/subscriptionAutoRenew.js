// backend/utils/subscriptionAutoRenew.js
// Auto-renews M365 licenses, Globe mobile plans, and "Other" Subscriptions
// flagged auto_renew=TRUE once their current renewal_date has passed.
// Runs on server startup and every 24h (see server.js), same pattern as
// contractAutoRenew.js / logCleanup.js.
//
// M365 / Globe   → always yearly (1-year cycle) — renewal_date advances
//                  by 1 year per missed cycle.
// Subscriptions  → advances by billing_cycle + billing_interval (monthly
//                  or yearly, every N). One-time subscriptions are never
//                  auto-renewed even if auto_renew was somehow set.

const pool = require("../db");
const { logItemHistory } = require("./itemHistory");

function advanceDate(dateStr, cycle, interval) {
  const step = Math.max(1, parseInt(interval) || 1);
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let renewed = false;
  while (d < today) {
    if (cycle === 'monthly') d.setMonth(d.getMonth() + step);
    else d.setFullYear(d.getFullYear() + step);
    renewed = true;
  }
  return { newDate: d.toISOString().slice(0, 10), renewed };
}

async function processSubscriptionAutoRenewals() {
  try {
    // ── M365 (always yearly) ──
    const m365Res = await pool.query(
      `SELECT license_id, assigned_email, renewal_date FROM m365 WHERE auto_renew = TRUE AND renewal_date IS NOT NULL`
    );
    for (const m of m365Res.rows) {
      const { newDate, renewed } = advanceDate(m.renewal_date, 'yearly', 1);
      if (renewed) {
        await pool.query("UPDATE m365 SET renewal_date=$1 WHERE license_id=$2", [newDate, m.license_id]);
        await logItemHistory({
          module: "m365", record_id: m.license_id, action: "RENEWED",
          field_name: "renewal_date", old_value: m.renewal_date, new_value: newDate,
          remarks: `Auto-renewed — ${m.assigned_email}`,
          performed_by_name: "System (Auto-Renew)",
        });
        console.log(`🔄 Auto-renewed M365 #${m.license_id} (${m.assigned_email}): ${m.renewal_date} → ${newDate}`);
      }
    }

    // ── Globe (always yearly) ──
    const globeRes = await pool.query(
      `SELECT plan_id, plan_name, mobile_number, renewal_date FROM globe_mobile_plan WHERE auto_renew = TRUE AND renewal_date IS NOT NULL`
    );
    for (const g of globeRes.rows) {
      const { newDate, renewed } = advanceDate(g.renewal_date, 'yearly', 1);
      if (renewed) {
        await pool.query("UPDATE globe_mobile_plan SET renewal_date=$1 WHERE plan_id=$2", [newDate, g.plan_id]);
        await logItemHistory({
          module: "globe", record_id: g.plan_id, action: "RENEWED",
          field_name: "renewal_date", old_value: g.renewal_date, new_value: newDate,
          remarks: `Auto-renewed — ${g.plan_name || g.mobile_number}`,
          performed_by_name: "System (Auto-Renew)",
        });
        console.log(`🔄 Auto-renewed Globe #${g.plan_id}: ${g.renewal_date} → ${newDate}`);
      }
    }

    // ── Other Subscriptions (monthly/yearly, custom interval) ──
    const subRes = await pool.query(
      `SELECT subscription_id, subscription_name, billing_cycle, billing_interval, renewal_date
       FROM subscriptions
       WHERE auto_renew = TRUE AND renewal_date IS NOT NULL AND billing_cycle IN ('monthly','yearly')`
    );
    for (const s of subRes.rows) {
      const { newDate, renewed } = advanceDate(s.renewal_date, s.billing_cycle, s.billing_interval);
      if (renewed) {
        await pool.query("UPDATE subscriptions SET renewal_date=$1 WHERE subscription_id=$2", [newDate, s.subscription_id]);
        await logItemHistory({
          module: "subscriptions", record_id: s.subscription_id, action: "RENEWED",
          field_name: "renewal_date", old_value: s.renewal_date, new_value: newDate,
          remarks: `Auto-renewed — ${s.subscription_name}`,
          performed_by_name: "System (Auto-Renew)",
        });
        console.log(`🔄 Auto-renewed Subscription #${s.subscription_id} (${s.subscription_name}): ${s.renewal_date} → ${newDate}`);
      }
    }
  } catch (err) {
    console.error("Subscription auto-renew error:", err);
  }
}

module.exports = processSubscriptionAutoRenewals;