const router = require('express').Router();
const { query } = require('../db');
const { wrap, HttpError, reqDate, reqMoney, optString, reqInt } = require('../util');
const { monthStart, nextMonthStart } = require('../report');

const SELECT = `
  SELECT e.id, e.spent_on AS date, e.description, e.category_id, c.name AS category,
         e.amount, e.payment_method_id, pm.name AS payment_method, e.need_want, e.kind,
         ((EXTRACT(DAY FROM e.spent_on)::int - 1) / 7) + 1 AS week
    FROM expenses e
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id`;

function buildFilter(userId, q) {
  const where = ['e.user_id = $1'];
  const params = [userId];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('?', `$${params.length}`)); };
  if (q.year && q.month) {
    const y = reqInt(q.year, 'year', 2000, 2100), m = reqInt(q.month, 'month', 1, 12);
    add('e.spent_on >= ?', monthStart(y, m));
    add('e.spent_on < ?', nextMonthStart(y, m));
  } else if (q.year) {
    const y = reqInt(q.year, 'year', 2000, 2100);
    add('e.spent_on >= ?', `${y}-01-01`);
    add('e.spent_on < ?', `${y + 1}-01-01`);
  }
  if (q.category_id === 'none') where.push('e.category_id IS NULL');
  else if (q.category_id) add('e.category_id = ?', reqInt(q.category_id, 'category_id', 1));
  if (q.payment_method_id) add('e.payment_method_id = ?', reqInt(q.payment_method_id, 'payment_method_id', 1));
  if (q.kind) add('e.kind = ?', q.kind);
  if (q.need_want === 'none') where.push('e.need_want IS NULL');
  else if (q.need_want) add('e.need_want = ?', q.need_want);
  if (q.week) add("((EXTRACT(DAY FROM e.spent_on)::int - 1) / 7) + 1 = ?", reqInt(q.week, 'week', 1, 5));
  if (q.q) add('e.description ILIKE ?', `%${String(q.q).replace(/[%_\\]/g, '\\$&')}%`);
  return { where: where.join(' AND '), params };
}

async function parseBody(userId, b) {
  const v = {
    date: reqDate(b.date),
    description: optString(b.description, 300),
    amount: reqMoney(b.amount, 'Amount'),
    category_id: b.category_id ? reqInt(b.category_id, 'category_id', 1) : null,
    payment_method_id: b.payment_method_id ? reqInt(b.payment_method_id, 'payment_method_id', 1) : null,
    need_want: b.need_want || null,
    kind: b.kind || 'Regular',
  };
  if (v.need_want && !['Need', 'Want'].includes(v.need_want)) throw new HttpError(400, 'Need/Want must be Need or Want');
  if (!['Regular', 'Unexpected'].includes(v.kind)) throw new HttpError(400, 'Type must be Regular or Unexpected');
  if (v.category_id) {
    const r = await query('SELECT 1 FROM categories WHERE id=$1 AND user_id=$2', [v.category_id, userId]);
    if (!r.rowCount) throw new HttpError(400, 'Unknown category');
  }
  if (v.payment_method_id) {
    const r = await query('SELECT 1 FROM payment_methods WHERE id=$1 AND user_id=$2', [v.payment_method_id, userId]);
    if (!r.rowCount) throw new HttpError(400, 'Unknown payment method');
  }
  return v;
}

router.get('/', wrap(async (req, res) => {
  const { where, params } = buildFilter(req.userId, req.query);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const [items, agg] = await Promise.all([
    query(`${SELECT} WHERE ${where} ORDER BY e.spent_on DESC, e.id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS sum,
                  COALESCE(SUM(amount) FILTER (WHERE kind='Unexpected'),0) AS unexpected
             FROM expenses e WHERE ${where}`, params),
  ]);
  res.json({ items: items.rows, ...agg.rows[0], limit, offset });
}));

const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/export.csv', wrap(async (req, res) => {
  const { where, params } = buildFilter(req.userId, req.query);
  const { rows } = await query(`${SELECT} WHERE ${where} ORDER BY e.spent_on, e.id`, params);
  const head = ['Date', 'Description', 'Category', 'Amount (PKR)', 'Payment Method', 'Need / Want', 'Type', 'Week'];
  const lines = [head.join(',')].concat(rows.map((r) =>
    [r.date, r.description, r.category, r.amount, r.payment_method, r.need_want, r.kind, `Week ${r.week}`].map(csvCell).join(',')));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="expenses.csv"' });
  res.send('\ufeff' + lines.join('\r\n'));
}));

router.post('/', wrap(async (req, res) => {
  const v = await parseBody(req.userId, req.body);
  const { rows } = await query(
    `INSERT INTO expenses (user_id, spent_on, description, category_id, amount, payment_method_id, need_want, kind)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [req.userId, v.date, v.description, v.category_id, v.amount, v.payment_method_id, v.need_want, v.kind]);
  const out = await query(`${SELECT} WHERE e.id=$1`, [rows[0].id]);
  res.status(201).json(out.rows[0]);
}));

router.put('/:id', wrap(async (req, res) => {
  const id = reqInt(req.params.id, 'id', 1);
  const v = await parseBody(req.userId, req.body);
  const r = await query(
    `UPDATE expenses SET spent_on=$3, description=$4, category_id=$5, amount=$6, payment_method_id=$7,
            need_want=$8, kind=$9, updated_at=now()
      WHERE id=$1 AND user_id=$2 RETURNING id`,
    [id, req.userId, v.date, v.description, v.category_id, v.amount, v.payment_method_id, v.need_want, v.kind]);
  if (!r.rowCount) throw new HttpError(404, 'Expense not found');
  const out = await query(`${SELECT} WHERE e.id=$1`, [id]);
  res.json(out.rows[0]);
}));

router.delete('/:id', wrap(async (req, res) => {
  const id = reqInt(req.params.id, 'id', 1);
  const r = await query('DELETE FROM expenses WHERE id=$1 AND user_id=$2', [id, req.userId]);
  if (!r.rowCount) throw new HttpError(404, 'Expense not found');
  res.status(204).end();
}));

module.exports = router;
