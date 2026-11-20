const { Pool, types } = require('pg');
const fs = require('fs');
const path = require('path');

// NUMERIC -> number, BIGINT (COUNT) -> number, DATE -> 'YYYY-MM-DD' string (no timezone shifts)
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://expense:expense@localhost:5432/expense_tracker',
});

const query = (text, params) => pool.query(text, params);

async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`[db] waiting for database (${i}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Database not reachable');
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[db] schema ready');
}

module.exports = { pool, query, waitForDb, migrate };
