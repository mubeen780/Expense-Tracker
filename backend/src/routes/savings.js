const router = require('express').Router();
const { query } = require('../db');
const { wrap, HttpError, reqInt, reqMoney, reqString } = require('../util');
const { savingsReport } = require('../report');

router.get('/', wrap(async (req, res) => {
  res.json(await savingsReport(req.userId, reqInt(req.query.year, 'year', 2000, 2100)));
}));

router.put('/actual', wrap(async (req, res) => {
  const year = reqInt(req.body.year, 'year', 2000, 2100);
  const month = reqInt(req.body.month, 'month', 1, 12);
  const amount = reqMoney(req.body.amount, 'Amount');
  await query(
    `INSERT INTO savings_actual (user_id, year, month, amount) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, year, month) DO UPDATE SET amount = EXCLUDED.amount`,
    [req.userId, year, month, amount]);
  res.json({ ok: true });
}));

const parseGoal = (b) => ({
  name: reqString(b.name, 'Goal name', 100),
  target: reqMoney(b.target_amount ?? 0, 'Target amount'),
  saved: reqMoney(b.saved_so_far ?? 0, 'Saved so far'),
  monthly: reqMoney(b.monthly_contribution ?? 0, 'Monthly contribution'),
});

router.post('/goals', wrap(async (req, res) => {
  const g = parseGoal(req.body);
  const { rows } = await query(
    `INSERT INTO savings_goals (user_id,name,target_amount,saved_so_far,monthly_contribution,sort_order)
     VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(sort_order),0)+1 FROM savings_goals WHERE user_id=$1)) RETURNING id`,
    [req.userId, g.name, g.target, g.saved, g.monthly]);
  res.status(201).json(rows[0]);
}));

router.put('/goals/:id', wrap(async (req, res) => {
  const id = reqInt(req.params.id, 'id', 1);
  const g = parseGoal(req.body);
  const r = await query(
    `UPDATE savings_goals SET name=$3,target_amount=$4,saved_so_far=$5,monthly_contribution=$6
      WHERE id=$1 AND user_id=$2`, [id, req.userId, g.name, g.target, g.saved, g.monthly]);
  if (!r.rowCount) throw new HttpError(404, 'Goal not found');
  res.json({ ok: true });
}));

router.delete('/goals/:id', wrap(async (req, res) => {
  const id = reqInt(req.params.id, 'id', 1);
  const r = await query('DELETE FROM savings_goals WHERE id=$1 AND user_id=$2', [id, req.userId]);
  if (!r.rowCount) throw new HttpError(404, 'Goal not found');
  res.status(204).end();
}));

module.exports = router;
