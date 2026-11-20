const router = require('express').Router();
const { query } = require('../db');
const { wrap, HttpError, reqInt, reqMoney, reqString } = require('../util');
const { INCOME_SOURCES } = require('../defaults');
const { getSettings } = require('../report');

router.get('/', wrap(async (req, res) => {
  const year = reqInt(req.query.year, 'year', 2000, 2100);
  const { rows } = await query('SELECT month, source, amount FROM income WHERE user_id=$1 AND year=$2', [req.userId, year]);
  const sources = [...INCOME_SOURCES];
  for (const r of rows) if (!sources.includes(r.source)) sources.push(r.source);
  const grid = sources.map((source) => {
    const months = Array(12).fill(0);
    rows.filter((r) => r.source === source).forEach((r) => { months[r.month - 1] = r.amount; });
    return { source, months, total: months.reduce((a, b) => a + b, 0) };
  });
  const monthTotals = Array.from({ length: 12 }, (_, i) => grid.reduce((s, g) => s + g.months[i], 0));
  const total = monthTotals.reduce((a, b) => a + b, 0);
  const settings = await getSettings(req.userId);
  res.json({ year, grid, monthTotals, total, average: total / 12, salary: settings.monthly_salary });
}));

router.put('/', wrap(async (req, res) => {
  const year = reqInt(req.body.year, 'year', 2000, 2100);
  const month = reqInt(req.body.month, 'month', 1, 12);
  const source = reqString(req.body.source, 'Source', 100);
  const amount = reqMoney(req.body.amount, 'Amount');
  await query(
    `INSERT INTO income (user_id, year, month, source, amount) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, year, month, source) DO UPDATE SET amount = EXCLUDED.amount`,
    [req.userId, year, month, source, amount]);
  res.json({ ok: true });
}));

// Copy the salary from Settings into a range of months.
router.post('/fill-salary', wrap(async (req, res) => {
  const year = reqInt(req.body.year, 'year', 2000, 2100);
  const from = reqInt(req.body.from_month ?? 1, 'from_month', 1, 12);
  const to = reqInt(req.body.to_month ?? 12, 'to_month', 1, 12);
  if (from > to) throw new HttpError(400, 'from_month must be <= to_month');
  const { monthly_salary } = await getSettings(req.userId);
  await query(
    `INSERT INTO income (user_id, year, month, source, amount)
     SELECT $1, $2, m, 'Salary', $5 FROM generate_series($3::int, $4::int) AS m
     ON CONFLICT (user_id, year, month, source) DO UPDATE SET amount = EXCLUDED.amount`,
    [req.userId, year, from, to, monthly_salary]);
  res.json({ ok: true, amount: monthly_salary });
}));

module.exports = router;
