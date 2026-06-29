const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ✅ TEST CONNECTION
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("DB ERROR:", err);
  } else {
    console.log("DB CONNECTED ✅", res.rows);
  }
});


pool.query("SELECT current_database(), inet_server_addr()", (err, res) => {
  if (err) {
    console.error("DB CHECK ERROR:", err);
  } else {
    console.log("CONNECTED TO DB:", res.rows[0]);
  }
});

module.exports = pool;