// Defaults mirror the original Excel workbook (Budget + Lists sheets).
const DEFAULT_CATEGORIES = [
  ['Charity', 'Need'], ['Transport & Fuel', 'Need'], ['Go out with Czns', 'Need'],
  ['Wife', 'Need'], ['Mobile & Internet', 'Need'], ['Medical & Health', 'Need'],
  ['Kametti', 'Need'], ['Family Support', 'Need'], ['Dining Out', 'Want'],
  ['Shopping & Clothing', 'Want'], ['Subscriptions', 'Want'],
  ['Personal Care / Gym Diet', 'Want'], ['Other / Miscellaneous', 'Want'],
  ['Unexpected / Emergency', 'Need'],
];

const DEFAULT_PAYMENT_METHODS = [
  'Cash', 'Debit Card (Meezan)', 'Bank Transfer (Meezan)', 'JazzCash', 'Easypaisa',
  'SadaPay', 'Debit Card (Alfalah)', 'Bank Transfer (Alfalah)', 'Other',
];

const INCOME_SOURCES = [
  'Salary', 'Freelance / Side Income', 'Bonus / Commission',
  'Rental / Other Income', 'Gifts / Misc. Income',
];

async function seedDefaults(db, userId) {
  await db.query('INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  for (const [i, [name, type]] of DEFAULT_CATEGORIES.entries()) {
    await db.query(
      'INSERT INTO categories (user_id, name, type, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [userId, name, type, i],
    );
  }
  for (const [i, name] of DEFAULT_PAYMENT_METHODS.entries()) {
    await db.query(
      'INSERT INTO payment_methods (user_id, name, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [userId, name, i],
    );
  }
}

module.exports = { DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS, INCOME_SOURCES, seedDefaults };
