const router = require('express').Router();
const { query } = require('../db');
const { wrap, reqMoney, reqFraction } = require('../util');
const { getSettings } = require('../report');

router.get('/', wrap(async (req, res) => res.json(await getSettings(req.userId))));

router.put('/', wrap(async (req, res) => {
  const b = req.body;
  const cur = await getSettings(req.userId);
  const v = {
    monthly_salary: b.monthly_salary === undefined ? cur.monthly_salary : reqMoney(b.monthly_salary, 'Monthly salary'),
    warn_threshold: b.warn_threshold === undefined ? cur.warn_threshold : reqFraction(b.warn_threshold, 'Warning threshold'),
    savings_target_pct: b.savings_target_pct === undefined ? cur.savings_target_pct : reqFraction(b.savings_target_pct, 'Savings target'),
    need_guideline: b.need_guideline === undefined ? cur.need_guideline : reqFraction(b.need_guideline, 'Need guideline'),
    want_guideline: b.want_guideline === undefined ? cur.want_guideline : reqFraction(b.want_guideline, 'Want guideline'),
  };
  if (v.warn_threshold <= 0) v.warn_threshold = 0.01;
  await query(
    `INSERT INTO settings (user_id, monthly_salary, warn_threshold, savings_target_pct, need_guideline, want_guideline)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET monthly_salary=$2, warn_threshold=$3,
       savings_target_pct=$4, need_guideline=$5, want_guideline=$6`,
    [req.userId, v.monthly_salary, v.warn_threshold, v.savings_target_pct, v.need_guideline, v.want_guideline]);
  res.json(await getSettings(req.userId));
}));

module.exports = router;
