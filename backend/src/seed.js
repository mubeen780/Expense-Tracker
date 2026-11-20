// Demo account built from the sample data in Expense_Savings_Tracker_PKR.xlsx.
// NOTE: the workbook's sample amounts and budgets were all 0, so the amounts/budgets
// below are illustrative assumptions (budgets add up to salary - 15% savings target).
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { seedDefaults } = require('./defaults');

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo12345';

const BUDGETS = {
  'Charity': 2000, 'Transport & Fuel': 6000, 'Go out with Czns': 2500, 'Wife': 4000,
  'Mobile & Internet': 2500, 'Medical & Health': 3000, 'Kametti': 6000, 'Family Support': 5000,
  'Dining Out': 3000, 'Shopping & Clothing': 3000, 'Subscriptions': 1000,
  'Personal Care / Gym Diet': 2000, 'Other / Miscellaneous': 1500, 'Unexpected / Emergency': 3000,
  'Groceries': 8000, 'Utilities (Electricity/Gas/Water)': 5000, 'Education & Courses': 2000,
};
const EXTRA_CATEGORIES = [
  ['Groceries', 'Need'], ['Utilities (Electricity/Gas/Water)', 'Need'], ['Education & Courses', 'Need'],
];

// date, description, category, amount, payment method, need/want, kind
const EXPENSES = [
  ['2026-11-01', 'Kametti installment', 'Kametti', 6000, 'Bank Transfer (Meezan)', 'Need', 'Regular'],
  ['2026-11-02', 'Weekly groceries', 'Groceries', 2500, 'Cash', 'Need', 'Regular'],
  ['2026-11-03', 'Petrol', 'Transport & Fuel', 2000, 'Debit Card (Meezan)', 'Need', 'Regular'],
  ['2026-11-03', 'Lunch with friends', 'Dining Out', 1200, 'Cash', 'Want', 'Regular'],
  ['2026-11-04', 'Parents monthly support', 'Family Support', 5000, 'Bank Transfer (Alfalah)', 'Need', 'Regular'],
  ['2026-11-05', 'Internet bill', 'Mobile & Internet', 2300, 'Easypaisa', 'Need', 'Regular'],
  ['2026-11-05', 'Electricity bill', 'Utilities (Electricity/Gas/Water)', 3200, 'JazzCash', 'Need', 'Regular'],
  ['2026-11-06', 'Gas bill', 'Utilities (Electricity/Gas/Water)', 900, 'JazzCash', 'Need', 'Regular'],
  ['2026-11-07', 'Netflix & Spotify', 'Subscriptions', 1100, 'Debit Card (Alfalah)', 'Want', 'Regular'],
  ['2026-11-08', 'Groceries', 'Groceries', 1800, 'Cash', 'Need', 'Regular'],
  ['2026-11-09', 'Haircut', 'Personal Care / Gym Diet', 600, 'Cash', 'Want', 'Regular'],
  ['2026-11-09', 'Online course fee', 'Education & Courses', 2000, 'Debit Card (Meezan)', 'Need', 'Regular'],
  ['2026-11-10', 'Petrol', 'Transport & Fuel', 2000, 'Debit Card (Meezan)', 'Need', 'Regular'],
  ['2026-11-10', 'Clothes', 'Shopping & Clothing', 3500, 'Debit Card (Meezan)', 'Want', 'Regular'],
  ['2026-11-11', 'Pharmacy', 'Medical & Health', 800, 'Cash', 'Need', 'Regular'],
  ['2026-11-12', 'Donation', 'Charity', 1500, 'Cash', 'Need', 'Regular'],
  ['2026-11-13', 'Groceries', 'Groceries', 2200, 'Debit Card (Meezan)', 'Need', 'Regular'],
  ['2026-11-14', 'Dinner out', 'Dining Out', 1800, 'Debit Card (Alfalah)', 'Want', 'Regular'],
  ['2026-11-14', 'Bike repair (breakdown)', 'Unexpected / Emergency', 1500, 'Cash', 'Need', 'Unexpected'],
  ['2026-11-15', 'Rickshaw / ride-hailing', 'Transport & Fuel', 450, 'Cash', 'Need', 'Regular'],
  ['2026-11-16', 'Coffee', 'Dining Out', 350, 'Cash', 'Want', 'Regular'],
  ['2026-11-16', 'Doctor visit (unplanned)', 'Medical & Health', 1200, 'Cash', 'Need', 'Unexpected'],
  ['2026-11-17', 'Groceries', 'Groceries', 1500, 'Cash', 'Need', 'Regular'],
];

async function seedDemo() {
  const exists = await pool.query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL]);
  if (exists.rowCount) return false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const { rows } = await client.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id',
      [DEMO_EMAIL, 'Demo User', hash],
    );
    const uid = rows[0].id;
    await seedDefaults(client, uid);
    await client.query('UPDATE settings SET monthly_salary = 70000 WHERE user_id = $1', [uid]);

    for (const [i, [name, type]] of EXTRA_CATEGORIES.entries()) {
      await client.query(
        'INSERT INTO categories (user_id, name, type, sort_order) VALUES ($1,$2,$3,$4)',
        [uid, name, type, 100 + i],
      );
    }
    for (const [name, budget] of Object.entries(BUDGETS)) {
      await client.query(
        'UPDATE categories SET monthly_budget = $3 WHERE user_id = $1 AND name = $2', [uid, name, budget],
      );
    }

    const cats = Object.fromEntries(
      (await client.query('SELECT id, name FROM categories WHERE user_id=$1', [uid])).rows.map((r) => [r.name, r.id]),
    );
    const pms = Object.fromEntries(
      (await client.query('SELECT id, name FROM payment_methods WHERE user_id=$1', [uid])).rows.map((r) => [r.name, r.id]),
    );
    for (const [date, desc, cat, amount, pm, nw, kind] of EXPENSES) {
      await client.query(
        `INSERT INTO expenses (user_id, spent_on, description, category_id, amount, payment_method_id, need_want, kind)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uid, date, desc, cats[cat], amount, pms[pm], nw, kind],
      );
    }
    for (const m of [9, 10, 11]) {
      await client.query(
        "INSERT INTO income (user_id, year, month, source, amount) VALUES ($1,2026,$2,'Salary',70000)", [uid, m],
      );
    }
    await client.query('INSERT INTO savings_actual (user_id, year, month, amount) VALUES ($1,2026,11,5000)', [uid]);
    const goals = [['Kametti', 60000, 6000, 6000], ['New Laptop', 0, 0, 0], ['Umrah / Family Trip', 0, 0, 0]];
    for (const [i, [name, target, saved, monthly]] of goals.entries()) {
      await client.query(
        `INSERT INTO savings_goals (user_id, name, target_amount, saved_so_far, monthly_contribution, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uid, name, target, saved, monthly, i],
      );
    }
    await client.query('COMMIT');
    console.log(`[seed] demo user created: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { seedDemo };
