const router = require('express').Router();
const { wrap, reqInt } = require('../util');
const { dashboard, weekDetail } = require('../report');

router.get('/dashboard', wrap(async (req, res) => {
  res.json(await dashboard(req.userId, reqInt(req.query.year, 'year', 2000, 2100), reqInt(req.query.month, 'month', 1, 12)));
}));

router.get('/weekly', wrap(async (req, res) => {
  const y = reqInt(req.query.year, 'year', 2000, 2100), m = reqInt(req.query.month, 'month', 1, 12);
  res.json(await weekDetail(req.userId, y, m, reqInt(req.query.week ?? 1, 'week', 1, 5)));
}));

module.exports = router;
