const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
``

pool.query("SELECT NOW()", (err, res) => {
  if (err) console.error(err);
  else console.log("DB connected:", res.rows);
});
