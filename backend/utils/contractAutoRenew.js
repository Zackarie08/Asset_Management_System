// backend/utils/contractAutoRenew.js
// Auto-renews contracts flagged auto_renew=TRUE once their current
// validity period has expired. Runs on server startup and every 24h
// (see server.js), same pattern as logCleanup.js.
//
// YEAR type   → valid_year + 1 (loops if multiple years were missed)
// RANGE type  → both valid_from and valid_to shifted forward by 1 year
//               (e.g. Aug 2026–Aug 2027 → Aug 2027–Aug 2028)
// NA type     → never touched (no expiry to renew)

const pool = require("../db");
const { logItemHistory } = require("./itemHistory");

async function processContractAutoRenewals() {
  try {
    const result = await pool.query(
      `SELECT * FROM contracts WHERE auto_renew = TRUE AND validity_type IN ('YEAR','RANGE')`
    );

    for (const c of result.rows) {
      let renewed = false;
      let oldLabel, newLabel;

      if (c.validity_type === 'YEAR' && c.valid_year) {
        let year = parseInt(c.valid_year);
        const originalYear = year;
        while (new Date(`${year}-12-31`) < new Date()) {
          year += 1;
          renewed = true;
        }
        if (renewed) {
          oldLabel = String(originalYear);
          newLabel = String(year);
          await pool.query("UPDATE contracts SET valid_year=$1 WHERE contract_id=$2", [year, c.contract_id]);
        }
      } else if (c.validity_type === 'RANGE' && c.valid_from && c.valid_to) {
        let from = new Date(c.valid_from);
        let to   = new Date(c.valid_to);
        const originalFrom = c.valid_from;
        const originalTo   = c.valid_to;
        while (to < new Date()) {
          from.setFullYear(from.getFullYear() + 1);
          to.setFullYear(to.getFullYear() + 1);
          renewed = true;
        }
        if (renewed) {
          const newFrom = from.toISOString().slice(0, 10);
          const newTo   = to.toISOString().slice(0, 10);
          oldLabel = `${originalFrom} to ${originalTo}`;
          newLabel = `${newFrom} to ${newTo}`;
          await pool.query(
            "UPDATE contracts SET valid_from=$1, valid_to=$2 WHERE contract_id=$3",
            [newFrom, newTo, c.contract_id]
          );
        }
      }

      if (renewed) {
        await logItemHistory({
          module: "contracts",
          record_id: c.contract_id,
          action: "RENEWED",
          field_name: c.validity_type === 'YEAR' ? 'valid_year' : 'validity_range',
          old_value: oldLabel,
          new_value: newLabel,
          remarks: `Auto-renewed — ${c.other_party}`,
          performed_by_name: "System (Auto-Renew)",
        });
        console.log(`🔄 Auto-renewed contract #${c.contract_id} (${c.other_party}): ${oldLabel} → ${newLabel}`);
      }
    }
  } catch (err) {
    console.error("Contract auto-renew error:", err);
  }
}

module.exports = processContractAutoRenewals;